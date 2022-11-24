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
//Verify JWT Token
const verifyJWT = async (req, res, next) => {
	const authHeader = req.headers.authorization;
	console.log(req.headers);
	if (!authHeader) {
		return res.status(401).send({ message: 'Unauthorized Access' });
	}
	try {
		const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN);
		req.decoded = decoded;
	} catch (err) {
		return res.status(403).send({ message: 'Access Forbidden' });
	}
	next();
};

// Run MongoDB Database
const run = async () => {
	try {
		const database = client.db('mBuySellDB');
		const productCollection = database.collection('products');
		const userCollection = database.collection('users');
		const categoryCollection = database.collection('categories');

		//All Product Operation
		app.get('/products/:uid', async (req, res) => {
			console.log(req.decoded);
			const uid = req.params.uid;
			const query = { seller_uid: uid };
			const products = await productCollection.find(query).toArray();
			res.send(products);
		});
		app.post('/products', verifyJWT, async (req, res) => {
			const product = req.body;
			const result = await productCollection.insertOne(product);
			res.send(result);
		});

		//All User Operation
		app.post('/jwt', async (req, res) => {
			const user = req.body;
			jwt.sign(user, process.env.JWT_ACCESS_TOKEN, (err, token) => {
				console.log(token);
				res.send({ accessToken: token });
			});
			console.log(user);
		});

		//save new user
		app.post('/users', async (req, res) => {
			const user = req.body;
			const result = await userCollection.insertOne(user);
			res.send(result);
		});

		//All Admin Operation
		app.get('/user/admin/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { uid };
			const user = await userCollection.findOne(query);
			res.send({ isAdmin: user?.role === 'admin' ? true : false });
		});

		//All Seller Operation
		app.get('/user/seller/:uid', async (req, res) => {
			
			const uid = req.params.uid;
			const query = { uid: uid };
			const user = await userCollection.findOne(query);
			res.send({ isSeller: user?.role === 'seller' ? true : false });
		});
	} finally {
	}
};
run().catch((err) => console.log(err));

app.listen(port, () => {
	console.log(`mBuySell Server Run On ${port}`);
});
