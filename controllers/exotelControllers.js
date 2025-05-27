// controllers/exotelController.js - Complete Exotel controller implementation

const exotelService = require('../services/exotelServices');
const { Call } = require('../models/Calls');
const { User } = require('../models/Users');
const { Admin } = require('../models/Admins');
const { ActivityLog } = require('../models/ActivityLogs');
const { Notification } = require('../models/Notifications');
const unifiedGtmService = require('../services/gtmTrackingServices');

const ExotelController = {
    /**
     * Make an outbound call
     */
    makeCall: async (req, res) => {
        try {
            const {
                from,
                to,
                callerId,
                url,
                record = true,
                timeLimit,
                customField1,
                customField2
            } = req.body;

            const adminId = req.adminId;

            // Validate required fields
            if (!from || !to || !callerId) {
                return res.status(400).json({
                    success: false,
                    message: "from, to, and callerId are required"
                });
            }

            // Check if Exotel is configured
            if (!exotelService.isConfigured()) {
                return res.status(500).json({
                    success: false,
                    message: "Exotel service not properly configured"
                });
            }

            // Format phone numbers
            const formattedFrom = exotelService.formatPhoneNumber(from);
            const formattedTo = exotelService.formatPhoneNumber(to);
            const formattedCallerId = exotelService.formatPhoneNumber(callerId);

            // Prepare call options
            const callOptions = {
                record,
                timeLimit,
                customField1,
                customField2
            };

            // Add webhook URLs if base URL is configured
            const baseUrl = process.env.APP_BASE_URL;
            if (baseUrl) {
                const callbacks = exotelService.generateCallbackUrls(baseUrl);
                callOptions.statusCallback = callbacks.statusCallback;
                if (url) callOptions.url = url;
            }

            console.log(`📞 Initiating call from ${formattedFrom} to ${formattedTo}`);

            // Make the call
            const result = await exotelService.makeCall(
                formattedFrom,
                formattedTo,
                formattedCallerId,
                callOptions
            );

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: "Failed to initiate call",
                    error: result.error
                });
            }

            // Save call to database
            const callRecord = await Call.create({
                callSid: result.callSid,
                adminId: adminId,
                fromNumber: formattedFrom,
                toNumber: formattedTo,
                callerId: formattedCallerId,
                status: result.status || 'initiated',
                direction: 'outbound',
                exotelData: result.data,
                recordingEnabled: record,
                customFields: {
                    customField1,
                    customField2
                },
                createdAt: new Date()
            });

            // Get admin details for logging
            const admin = await Admin.findById(adminId);

            // Track call initiation
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'call_initiated',
                    event_category: 'communication',
                    call_id: callRecord._id,
                    call_sid: result.callSid,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        from_number: formattedFrom,
                        to_number: formattedTo,
                        caller_id: formattedCallerId,
                        recording_enabled: record,
                        initiated_by: admin ? `${admin.first_name} ${admin.last_name}` : 'Unknown Admin',
                        call_direction: 'outbound'
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking call initiation:', trackingError);
            }

            // Log admin activity
            await ActivityLog.create({
                actorId: adminId,
                actorModel: 'Admins',
                actorName: admin ? `${admin.first_name} ${admin.last_name}` : null,
                action: 'call_initiated',
                entityType: 'Call',
                entityId: callRecord._id,
                description: `Initiated call from ${formattedFrom} to ${formattedTo}`,
                adminId: adminId
            });

            return res.status(201).json({
                success: true,
                message: "Call initiated successfully",
                data: {
                    callId: callRecord._id,
                    callSid: result.callSid,
                    status: result.status,
                    from: formattedFrom,
                    to: formattedTo,
                    callerId: formattedCallerId,
                    exotelData: result.data
                }
            });

        } catch (error) {
            console.error("Error making call:", error);

            // Track call initiation failure
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'call_initiation_failed',
                    event_category: 'communication',
                    user_id: req.adminId,
                    success: false,
                    error_message: error.message,
                    metadata: {
                        attempted_from: req.body.from,
                        attempted_to: req.body.to,
                        error_type: error.name || 'UnknownError'
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking call failure:', trackingError);
            }

            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Get call details
     */
    getCallDetails: async (req, res) => {
        try {
            const { callSid } = req.params;
            const adminId = req.adminId;

            if (!callSid) {
                return res.status(400).json({
                    success: false,
                    message: "Call SID is required"
                });
            }

            // Get call from database
            const callRecord = await Call.findOne({ 
                callSid: callSid, 
                adminId: adminId 
            });

            if (!callRecord) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found"
                });
            }

            // Get fresh details from Exotel
            const exotelResult = await exotelService.getCallDetails(callSid);

            if (exotelResult.success) {
                // Update call record with latest data
                callRecord.status = exotelResult.data.Call?.Status || callRecord.status;
                callRecord.duration = exotelResult.data.Call?.Duration || callRecord.duration;
                callRecord.answeredBy = exotelResult.data.Call?.AnsweredBy || callRecord.answeredBy;
                callRecord.endTime = exotelResult.data.Call?.EndTime ? new Date(exotelResult.data.Call.EndTime) : callRecord.endTime;
                callRecord.exotelData = exotelResult.data;
                await callRecord.save();
            }

            return res.status(200).json({
                success: true,
                data: {
                    callRecord,
                    exotelData: exotelResult.success ? exotelResult.data : null,
                    error: exotelResult.success ? null : exotelResult.error
                }
            });

        } catch (error) {
            console.error("Error getting call details:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Get list of calls with filters
     */
    getCalls: async (req, res) => {
        try {
            const adminId = req.adminId;
            const {
                from,
                to,
                status,
                startDate,
                endDate,
                direction,
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            // Build database query
            const query = { adminId };
            
            if (from) query.fromNumber = { $regex: from, $options: 'i' };
            if (to) query.toNumber = { $regex: to, $options: 'i' };
            if (status) query.status = status;
            if (direction) query.direction = direction;
            
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            // Build sort options
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

            // Calculate pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get total count
            const totalCount = await Call.countDocuments(query);

            // Execute query
            const calls = await Call.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'first_name last_name phone_number');

            return res.status(200).json({
                success: true,
                data: {
                    calls,
                    pagination: {
                        totalRecords: totalCount,
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        limit: parseInt(limit)
                    }
                }
            });

        } catch (error) {
            console.error("Error getting calls:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Get call recording
     */
    getCallRecording: async (req, res) => {
        try {
            const { callSid } = req.params;
            const { download = false } = req.query;
            const adminId = req.adminId;

            // Verify call belongs to admin
            const callRecord = await Call.findOne({ 
                callSid: callSid, 
                adminId: adminId 
            });

            if (!callRecord) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found"
                });
            }

            // Get recording details from Exotel
            const recordingResult = await exotelService.getCallRecording(callSid);

            if (!recordingResult.success) {
                return res.status(404).json({
                    success: false,
                    message: "Recording not found",
                    error: recordingResult.error
                });
            }

            // If download is requested, download the actual file
            if (download === 'true' && recordingResult.recordings?.[0]?.Uri) {
                const recordingUrl = recordingResult.recordings[0].Uri;
                const downloadResult = await exotelService.downloadRecording(recordingUrl);
                
                if (downloadResult.success) {
                    res.set({
                        'Content-Type': downloadResult.contentType || 'audio/wav',
                        'Content-Disposition': `attachment; filename="recording_${callSid}.wav"`,
                        'Content-Length': downloadResult.size
                    });
                    
                    return res.send(downloadResult.data);
                } else {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to download recording",
                        error: downloadResult.error
                    });
                }
            }

            // Update call record with recording info
            if (recordingResult.recordings?.[0]) {
                callRecord.recordingUrl = recordingResult.recordings[0].Uri;
                callRecord.recordingSid = recordingResult.recordings[0].Sid;
                callRecord.recordingDuration = recordingResult.recordings[0].Duration;
                await callRecord.save();
            }

            return res.status(200).json({
                success: true,
                data: {
                    recordings: recordingResult.recordings,
                    callRecord
                }
            });

        } catch (error) {
            console.error("Error getting call recording:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Hangup an active call
     */
    hangupCall: async (req, res) => {
        try {
            const { callSid } = req.params;
            const adminId = req.adminId;

            // Verify call belongs to admin
            const callRecord = await Call.findOne({ 
                callSid: callSid, 
                adminId: adminId 
            });

            if (!callRecord) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found"
                });
            }

            // Hangup call via Exotel
            const result = await exotelService.hangupCall(callSid);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: "Failed to hangup call",
                    error: result.error
                });
            }

            // Update call record
            callRecord.status = 'completed';
            callRecord.endTime = new Date();
            await callRecord.save();

            // Track call hangup
            try {
                await unifiedGtmService.trackEvent({
                    event_type: 'call_hung_up',
                    event_category: 'communication',
                    call_id: callRecord._id,
                    call_sid: callSid,
                    user_id: adminId,
                    success: true,
                    metadata: {
                        from_number: callRecord.fromNumber,
                        to_number: callRecord.toNumber,
                        call_duration: callRecord.duration,
                        hung_up_by: 'admin'
                    }
                });
            } catch (trackingError) {
                console.error('Error tracking call hangup:', trackingError);
            }

            return res.status(200).json({
                success: true,
                message: "Call hung up successfully",
                data: callRecord
            });

        } catch (error) {
            console.error("Error hanging up call:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Send DTMF digits to active call
     */
    sendDtmf: async (req, res) => {
        try {
            const { callSid } = req.params;
            const { digits } = req.body;
            const adminId = req.adminId;

            if (!digits) {
                return res.status(400).json({
                    success: false,
                    message: "Digits are required"
                });
            }

            // Verify call belongs to admin
            const callRecord = await Call.findOne({ 
                callSid: callSid, 
                adminId: adminId 
            });

            if (!callRecord) {
                return res.status(404).json({
                    success: false,
                    message: "Call not found"
                });
            }

            // Send DTMF via Exotel
            const result = await exotelService.sendDtmf(callSid, digits);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: "Failed to send DTMF",
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                message: "DTMF digits sent successfully",
                data: result.data
            });

        } catch (error) {
            console.error("Error sending DTMF:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Get account information
     */
    getAccountInfo: async (req, res) => {
        try {
            const result = await exotelService.getAccountInfo();

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: "Failed to get account info",
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    account: result.data,
                    balance: result.balance,
                    status: result.status
                }
            });

        } catch (error) {
            console.error("Error getting account info:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Get phone numbers
     */
    getPhoneNumbers: async (req, res) => {
        try {
            const result = await exotelService.getPhoneNumbers();

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: "Failed to get phone numbers",
                    error: result.error
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    phoneNumbers: result.phoneNumbers,
                    totalNumbers: result.phoneNumbers.length
                }
            });

        } catch (error) {
            console.error("Error getting phone numbers:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Webhook handler for call status updates
     */
    handleCallStatusWebhook: async (req, res) => {
        try {
            const {
                CallSid,
                CallStatus,
                CallDuration,
                From,
                To,
                Direction,
                AnsweredBy,
                CallType,
                RecordingUrl,
                RecordingSid,
                RecordingDuration,
                CustomField1,
                CustomField2
            } = req.body;

            console.log('📞 Received call status webhook:', req.body);

            // Find and update call record
            const callRecord = await Call.findOne({ callSid: CallSid });

            if (callRecord) {
                callRecord.status = CallStatus;
                callRecord.duration = CallDuration;
                callRecord.answeredBy = AnsweredBy;
                callRecord.callType = CallType;
                
                if (RecordingUrl) {
                    callRecord.recordingUrl = RecordingUrl;
                    callRecord.recordingSid = RecordingSid;
                    callRecord.recordingDuration = RecordingDuration;
                }

                if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
                    callRecord.endTime = new Date();
                }

                await callRecord.save();

                // Track call status change
                try {
                    await unifiedGtmService.trackEvent({
                        event_type: 'call_status_changed',
                        event_category: 'communication',
                        call_id: callRecord._id,
                        call_sid: CallSid,
                        user_id: callRecord.adminId,
                        success: true,
                        metadata: {
                            from_number: From,
                            to_number: To,
                            call_status: CallStatus,
                            call_duration: CallDuration,
                            answered_by: AnsweredBy,
                            has_recording: !!RecordingUrl
                        }
                    });
                } catch (trackingError) {
                    console.error('Error tracking call status change:', trackingError);
                }

                // Create notification for completed calls
                if (CallStatus === 'completed') {
                    try {
                        await Notification.create({
                            title: "Call Completed",
                            description: `Call from ${From} to ${To} completed. Duration: ${CallDuration || 0} seconds.`,
                            type: 'call_completed',
                            priority: 'low',
                            forAdmin: callRecord.adminId,
                            relatedTo: {
                                model: 'Call',
                                id: callRecord._id
                            },
                            metadata: {
                                callSid: CallSid,
                                duration: CallDuration,
                                hasRecording: !!RecordingUrl
                            }
                        });
                    } catch (notificationError) {
                        console.error('Error creating call completion notification:', notificationError);
                    }
                }
            }

            // Respond to Exotel
            return res.status(200).json({
                success: true,
                message: "Webhook processed successfully"
            });

        } catch (error) {
            console.error("Error processing call status webhook:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    },

    /**
     * Webhook handler for voice calls (TwiML response)
     */
    handleVoiceWebhook: async (req, res) => {
        try {
            const { CallSid, From, To } = req.body;
            
            console.log('🎤 Received voice webhook:', req.body);

            // Generate TwiML response
            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say voice="woman" language="en">Hello, you have reached our support line. Please hold while we connect you.</Say>
                    <Play>https://your-server.com/hold-music.mp3</Play>
                    <Dial timeout="30" record="true">
                        <Number>+911234567890</Number>
                    </Dial>
                    <Say voice="woman" language="en">We're sorry, no one is available to take your call. Please try again later.</Say>
                </Response>`;

            res.set('Content-Type', 'text/xml');
            return res.status(200).send(twimlResponse);

        } catch (error) {
            console.error("Error processing voice webhook:", error);
            
            // Fallback TwiML
            const fallbackResponse = `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say voice="woman" language="en">We're experiencing technical difficulties. Please try again later.</Say>
                    <Hangup/>
                </Response>`;

            res.set('Content-Type', 'text/xml');
            return res.status(200).send(fallbackResponse);
        }
    },

    /**
     * Get call analytics and statistics
     */
    getCallAnalytics: async (req, res) => {
        try {
            const adminId = req.adminId;
            const { startDate, endDate, groupBy = 'day' } = req.query;

            // Build date filter
            const dateFilter = { adminId };
            if (startDate || endDate) {
                dateFilter.createdAt = {};
                if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
                if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
            }

            // Get overall statistics
            const totalCalls = await Call.countDocuments(dateFilter);
            const completedCalls = await Call.countDocuments({ ...dateFilter, status: 'completed' });
            const failedCalls = await Call.countDocuments({ ...dateFilter, status: { $in: ['failed', 'busy', 'no-answer'] } });
            
            // Get average call duration
            const durationStats = await Call.aggregate([
                { $match: { ...dateFilter, duration: { $exists: true, $ne: null } } },
                {
                    $group: {
                        _id: null,
                        avgDuration: { $avg: { $toInt: "$duration" } },
                        totalDuration: { $sum: { $toInt: "$duration" } }
                    }
                }
            ]);

            // Get calls with recordings
            const recordedCalls = await Call.countDocuments({ 
                ...dateFilter, 
                recordingUrl: { $exists: true, $ne: null } 
            });

            // Get call distribution by status
            const statusDistribution = await Call.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$status", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Get call trends over time
            let groupByFormat;
            switch (groupBy) {
                case 'hour':
                    groupByFormat = { $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" } };
                    break;
                case 'month':
                    groupByFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
                    break;
                default: // day
                    groupByFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
            }

            const callTrends = await Call.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: groupByFormat,
                        totalCalls: { $sum: 1 },
                        completedCalls: {
                            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                        },
                        failedCalls: {
                            $sum: { $cond: [{ $in: ["$status", ["failed", "busy", "no-answer"]] }, 1, 0] }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    summary: {
                        totalCalls,
                        completedCalls,
                        failedCalls,
                        successRate: totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(2) : 0,
                        recordedCalls,
                        averageDuration: durationStats[0]?.avgDuration || 0,
                        totalDuration: durationStats[0]?.totalDuration || 0
                    },
                    statusDistribution,
                    callTrends,
                    dateRange: {
                        startDate: startDate || 'All time',
                        endDate: endDate || 'Now',
                        groupBy
                    }
                }
            });

        } catch (error) {
            console.error("Error getting call analytics:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
                error: error.message
            });
        }
    }
};

module.exports = ExotelController;