const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET);

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
	if (!authHeader) {
		return res
			.status(401)
			.send({ message: 'Unauthorized Access', code: 401 });
	}
	const token = authHeader.split(' ')[1];
	try {
		const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN);
		req.decoded = decoded;
	} catch (err) {
		return res.status(403).send({ message: 'Access Forbidden', code: 403 });
	}
	next();
};

// Run MongoDB Database
const run = async () => {
	try {
		//Database Name
		const database = client.db('mBuySellDB');
		//All Database Collection
		const productCollection = database.collection('products');
		const userCollection = database.collection('users');
		const categoryCollection = database.collection('categories');
		const orderCollection = database.collection('orders');
		const blogCollection = database.collection('blogs');
		const paymentCollection = database.collection('payments');

		// give a token when user login
		app.post('/jwt', async (req, res) => {
			const user = req.body;
			jwt.sign(user, process.env.JWT_ACCESS_TOKEN, (err, token) => {
				res.send({ accessToken: token });
			});
		});

		//Verify User role is Seller
		const verifySeller = async (req, res, next) => {
			const decoded = req.decoded;
			const sellerQuery = { uid: decoded.uid };
			const seller = await userCollection.findOne(sellerQuery);
			if (!seller && seller.role !== 'seller') {
				return res
					.status(403)
					.send({ message: 'Access Forbidden', code: 403 });
			}
			next();
		};
		//Verify user role is Admin
		const verifyAdmin = async (req, res, next) => {
			const decoded = req.decoded;
			const adminQuery = { uid: decoded.uid };
			const admin = await userCollection.findOne(adminQuery);
			if (!admin && admin.role !== 'admin') {
				return res
					.status(403)
					.send({ message: 'Access Forbidden', code: 403 });
			}
			next();
		};

		//---All Product Operation---//

		//Get all product created by seller
		app.get('/products/:uid', verifyJWT, verifySeller, async (req, res) => {
			const decoded = req.decoded;
			const uid = req.params.uid;
			const query = { seller_uid: uid };
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden', code: 403 });
			}
			const products = await productCollection
				.find(query)
				.sort({ createAt: -1 })
				.toArray();
			res.send(products);
		});
		//Get all product filter by category id
		app.get('/category/:id', async (req, res) => {
			const id = req.params.id;
			const query = { category_id: id };
			const products = await productCollection
				.find(query)
				.sort({ createAt: -1 })
				.toArray();
			res.send(products);
		});
		//Post only seller created product
		app.post(
			'/products/:uid',
			verifyJWT,
			verifySeller,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const product = req.body;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const result = await productCollection.insertOne(product);
				res.send(result);
			}
		);

		//---All Category Operation---//

		//Get all category list
		app.get('/categories', async (req, res) => {
			const query = {};
			const categories = await categoryCollection
				.find(query)
				.sort({ category_name: 1 })
				.toArray();
			res.send(categories);
		});

		//Create a category items by Seller
		app.post(
			'/categories/:uid',
			verifyJWT,
			verifySeller,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const new_category = req.body;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const result = await categoryCollection.insertOne(new_category);
				res.send(result);
			}
		);

		//---All User Operation---//
		//Check is user is buyer
		app.get('/user/buyer/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { uid: uid };
			const user = await userCollection.findOne(query);
			res.send({ isBuyer: user?.role === 'buyer' ? true : false });
		});

		//Report a seller created product by buyer, only buyer can report
		app.patch('/report-product/:uid', verifyJWT, async (req, res) => {
			const decoded = req.decoded;
			const uid = req.params.uid;
			const id = req.query.id;
			const prevReport = parseInt(req.query.reportCount);
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden', code: 403 });
			}
			const filter = { _id: ObjectId(id) };
			const option = { upsert: true };
			const updatedDoc = {
				$set: {
					reported: true,
					reportCount: prevReport + 1,
				},
			};

			const result = await productCollection.updateOne(
				filter,
				updatedDoc,
				option
			);
			res.send(result);
		});

		//Saved new user data on database
		app.post('/users', async (req, res) => {
			const user = req.body;
			const query = { uid: user.uid };
			const userInDb = await userCollection.findOne(query);
			if (userInDb?.uid) {
				return res.send({});
			}
			const result = await userCollection.insertOne(user);
			res.send(result);
		});

		//---All Admin Operation---//
		//Check user is Admin
		app.get('/user/admin/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { uid };
			const user = await userCollection.findOne(query);
			res.send({ isAdmin: user?.role === 'admin' ? true : false });
		});
		//Get all reported seller product
		app.get(
			'/reported-products/:uid',
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const query = { reported: true };
				const reportedProducts = await productCollection
					.find(query)
					.sort({ reportCount: 1 })
					.toArray();
				res.send(reportedProducts);
			}
		);
		//Get all user data filter by their role
		app.get(
			'/users-by-role/:uid',
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const role = req.query.role;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const query = { role };
				const users = await userCollection.find(query).toArray();
				res.send(users);
			}
		);

		//Undo report given by buyer(Admin Only)
		app.patch(
			'/report-product-safe/:uid',
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const filter = { _id: ObjectId(id) };
				const option = { upsert: true };
				const updatedDoc = {
					$set: {
						reported: false,
					},
				};

				const result = await productCollection.updateOne(
					filter,
					updatedDoc,
					option
				);
				res.send(result);
			}
		);
		// make seller verified
		app.patch(
			'/seller-verify/:uid',
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const filter = { _id: ObjectId(id) };
				const option = { upsert: true };
				const updatedDoc = {
					$set: {
						status: 'verified',
					},
				};

				const result = await userCollection.updateOne(
					filter,
					updatedDoc,
					option
				);
				res.send(result);
			}
		);
		//Delete user by admin
		app.delete(
			'/user-delete/:uid',
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const filter = { _id: ObjectId(id) };
				const result = await userCollection.deleteOne(filter);
				res.send(result);
			}
		);
		//Delete Reported product by admin
		app.delete(
			'/report-product-delete/:uid',
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const filter = { _id: ObjectId(id) };
				const result = await productCollection.deleteOne(filter);
				res.send(result);
			}
		);

		//---All Seller Operation---//
		//Checked Seller Verified
		app.get('/seller-verify/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { uid: uid };
			const seller = await userCollection.findOne(query);
			res.send({
				isVerified: seller?.status === 'verified' ? true : false,
			});
		});
		//Checked user is Seller
		app.get('/user/seller/:uid', async (req, res) => {
			const uid = req.params.uid;
			const query = { uid: uid };
			const user = await userCollection.findOne(query);
			res.send({ isSeller: user?.role === 'seller' ? true : false });
		});

		//Delete a product created by seller (delete by seller)
		app.delete(
			'/product-delete/:uid',
			verifyJWT,
			verifySeller,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const filter = { _id: ObjectId(id) };
				const result = await productCollection.deleteOne(filter);
				res.send(result);
			}
		);

		//---all orders operation---//
		//Get all order filter by user uid
		app.get('/orders/:uid', verifyJWT, async (req, res) => {
			const decoded = req.decoded;
			const uid = req.params.uid;
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden', code: 403 });
			}
			const query = { 'customer_info.customer_uid': uid };
			const orders = await orderCollection.find(query).toArray();
			res.send(orders);
		});
		//Get a single order by user uid and order id
		app.get('/order/:uid', verifyJWT, async (req, res) => {
			const decoded = req.decoded;
			const uid = req.params.uid;
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden', code: 403 });
			}
			const id = req.query.id;
			const query = { _id: ObjectId(id) };
			const order = await orderCollection.findOne(query);
			res.send(order);
		});
		//Create a order by user
		app.post('/orders/:uid', verifyJWT, async (req, res) => {
			const decoded = req.decoded;
			const uid = req.params.uid;
			if (uid !== decoded.uid) {
				return res
					.status(403)
					.send({ message: 'Access Forbidden', code: 403 });
			}
			const order = req.body;
			const result = await orderCollection.insertOne(order);
			res.send(result);

			const productQuery = {
				_id: ObjectId(order.product_info.product_id),
			};
			const option = { upsert: true };
			const orderedProduct = await productCollection.findOne(
				productQuery
			);
		});

		//All Promote Operation
		//Get All Promoted Product
		app.get('/promoted-product', async (req, res) => {
			const query = { promote: true };
			const products = await productCollection
				.find(query)
				.sort({ createAt: -1 })
				.toArray();
			res.send(products);
		});
		// Make a product to promoted product
		app.patch(
			'/promote-product/:uid',
			verifyJWT,
			verifySeller,
			async (req, res) => {
				const decoded = req.decoded;
				const uid = req.params.uid;
				const id = req.query.id;
				if (uid !== decoded.uid) {
					return res
						.status(403)
						.send({ message: 'Access Forbidden', code: 403 });
				}
				const filter = { _id: ObjectId(id) };
				const option = { upsert: true };
				const updatedDoc = {
					$set: {
						promote: true,
					},
				};

				const result = await productCollection.updateOne(
					filter,
					updatedDoc,
					option
				);
				res.send(result);
			}
		);

		//Blogs
		app.get('/blogs', async (req, res) => {
			const query = {};
			const blogs = await blogCollection.find(query).toArray();
			res.send(blogs);
		});

		//Create Payment Intent
		app.post('/create-payment-intent/:uid', verifyJWT, async (req, res) => {
			const uid = req.params.uid;
			const decode = req.decoded;
			const id = req.query.id;
			if (uid !== decode.uid) {
				return res
					.status(401)
					.send({ message: 'Unauthorized Access', code: 401 });
			}
			const query = { _id: ObjectId(id) };
			const product = await productCollection.findOne(query);
			const price = product?.resell_price * 100;
			const paymentIntent = await stripe.paymentIntents.create({
				amount: price,
				currency: 'usd',
				payment_method_types: ['card'],
			});
			res.send({ clientSecret: paymentIntent.client_secret });
		});

		//save payment data to database
		app.post('/payments/:uid', verifyJWT, async (req, res) => {
			const uid = req.params.uid;
			const decode = req.decoded;
			if (uid !== decode.uid) {
				return res
					.status(401)
					.send({ message: 'Unauthorized Access', code: 401 });
			}
			const payment = req.body;
			const result = await paymentCollection.insertOne(payment);
			res.send(result);
			//set order status true after payment done
			const orderQuery = { _id: ObjectId(payment.orderId) };
			const option = { upsert: true };
			const orderUpdatedDoc = {
				$set: {
					order_status: true,
				},
			};
			const orderResult = await orderCollection.updateOne(
				orderQuery,
				orderUpdatedDoc,
				option
			);
			//set order status true and promote status false after payment done
			const productQuery = { _id: ObjectId(payment.product_id) };
			const productUpdatedDoc = {
				$set: {
					order_status: true,
					promote: false,
				},
			};
			const productResult = await productCollection.updateOne(
				productQuery,
				productUpdatedDoc,
				option
			);
		});
	} finally {
	}
};
run().catch((err) => console.log(err));

app.listen(port, () => {
	console.log(`mBuySell Server Run On ${port}`);
});