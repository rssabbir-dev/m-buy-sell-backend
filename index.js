const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const app = express();

//Middleware
app.use(cors());
app.use(express.json());

//Normal Path
app.get('/', (req, res) => {
	res.send('mBuySell Server Running');
});

//MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.z9hjm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

// Run MongoDB Database
const run = async () => {
	try {
		const database = client.db('mBuySellDB');
		const productCollection = database.collection('products');
		const userCollection = database.collection('users');
		const categoryCollection = database.collection('categories');

		//All User Operation
		//save new user
		app.post('/users', async (req, res) => {
			const user = req.body;
			const result = await userCollection.insertOne(user);
			res.send(result);
		});

		//All Admin Operation
		app.get('/user/admin/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { uid: uid };
			const user = await userCollection.findOne(query);
			res.send({ isAdmin: user.role === 'admin' ? true : false });
		});

		//All Seller Operation
		app.get('/user/seller/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { uid: uid };
			const user = await userCollection.findOne(query);
			res.send({ isSeller: user.role === 'seller' ? true : false });
		});
	} finally {
	}
};
run().catch((err) => console.log(err));

app.listen(port, () => {
	console.log(`mBuySell Server Run On ${port}`);
});
