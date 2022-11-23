const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken')
const app = express();

//Middleware
app.use(cors());
app.use(express.json());

//Normal Path
app.get('/', (req, res) => {
    res.send('mBuySell Server Running');
})

//MongoDB
const uri =
	'mongodb+srv://<username>:<password>@cluster0.z9hjm.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

// Run MongoDB Database
const run = async () => {
    try {
        const database = client.db('mBuySellDB');
        const productCollection = database.collection('products')
        const userCollection = database.collection('users')
        const categoryCollection = database.collection('categories')
    }
    finally {
        
    }
}
run().catch(err => console.log(err))

app.listen(port, () => {
    console.log(`mBuySell Server Run On ${port}`);
})