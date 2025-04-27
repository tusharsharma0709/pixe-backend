const bcrypt = require("bcryptjs");
const { SuperAdmin } = require("../models/SuperAdmins");

const registerSuperAdmin = async (req, res) => {
  try {
    const { first_name, last_name, mobile, email_id, password } = req.body;

    const existing = await SuperAdmin.findOne({ email_id });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const superAdmin = new SuperAdmin({
      first_name,
      last_name,
      mobile,
      email_id,
      password: hashedPassword,
    });

    await superAdmin.save();

    res.status(201).json({ success: true, message: "Super admin registered successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
};
