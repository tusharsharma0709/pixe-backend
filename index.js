const express = require('express');
require("./db/conn");
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors())

const superAdminRoutes = require('./routes/superAdminRoutes'); //super admin routes
app.use('/superadmin', superAdminRoutes);
const adminRoutes = require('./routes/adminRoutes'); //admin routes
app.use('/admin', adminRoutes);
const userRoutes = require('./routes/userRoutes'); //user routes
app.use('/user', userRoutes);
const productRoutes = require('./routes/productRoutes'); //product routes
app.use('/product', productRoutes);
const surepassRoutes = require('./routes/surepassRoutes'); //surepass routes
app.use('/surepass', surepassRoutes);
const gtmRoutes = require('./routes/gtmRoutes'); //gtm routes
app.use('/gtm', gtmRoutes);


app.get("/", (req,res)=>{
    res.send("Hello! It is Pixe Backend");
});



const port = process.env.PORT || 5001

app.listen(port, () =>{
    console.log(`app is running at ${port}`);
})