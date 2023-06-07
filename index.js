const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 2000;

app.use(cors());
app.use(express.json());

app.get('/',(req,res) =>{
    res.send('Photography is starting')
})

app.listen(port, () =>{
    console.log(`Photography is sitting on port ${port}`);
})