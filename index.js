const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 2000;

app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g2hlfdf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    const usersCollection = client.db("PhotographDB").collection("users");
    const classesCollection = client.db("PhotographDB").collection("Classes");
    const selectedCollection = client.db("PhotographDB").collection("selects");
    const paymentCollection = client.db("PhotographDB").collection("payments");


    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({token})
    })


    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }


    app.get('/users',verifyJWT,verifyAdmin,async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/class', async(req,res) =>{
        const result = await classesCollection.find().toArray();
        result.sort((a, b) => b.numStudents - a.numStudents);
        res.send(result);
    });

    app.get('/selects',verifyJWT,async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forviden access' })
      }

      const query = { email: email };
      const result = await selectedCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/paymentinfo',verifyJWT,async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forviden access' })
      }

      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      result.sort((a, b) => new Date(b.date) - new Date(a.date));

      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });


    app.post('/class',verifyJWT,async (req, res) => {
      const newItem = req.body;
      const result = await classesCollection.insertOne(newItem)
      res.send(result);
    })


    app.post('/selects', async (req, res) => {
      const item = req.body;
      console.log(item);
      const result = await selectedCollection.insertOne(item);
      res.send(result);
    })

    app.delete('/selects/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    })


    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

    app.get('/users/student/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ student: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === 'student' }
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.patch('/class/approve/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.patch('/class/denied/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    app.patch('/class/dec/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $inc: {
          availableSeats:-1,
          numStudents:+1
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      console.log(result);
      res.send(result);

    })



//     app.patch('/class/dec/:id', async (req, res) => {
//   const id = req.params.id;
//   console.log(id);
//   const filter = { _id: new ObjectId(id) };
//   const updateDoc = {
//     $inc: {
//       availableSeats: -1
//     }
//   };

//   try {
//     const result = await classesCollection.updateOne(filter, updateDoc);
//     if (result.modifiedCount === 1) {
//       res.send({ success: true });
//     } else {
//       res.status(404).send({ success: false, message: 'Class not found' });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({ success: false, message: 'Internal server error' });
//   }
// });

      
      app.post('/create-payment-intent', verifyJWT, async (req, res) => {
        const { price } = req.body;
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
  
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      })
  
  
      // payment related api
    // app.post('/payments/:id', verifyJWT, async (req, res) => {
    //   const payment = req.body;
    //   const insertResult = await paymentCollection.insertOne(payment);

    //   const query = { _id: { $in: payment.SelectedItems.map(id => new ObjectId(id)) } }
    //   const deleteResult = await selectedCollection.deleteMany(query)

    //   res.send({ insertResult, deleteResult });
    // })


    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      console.log(req.body);
      const insertResult = await paymentCollection.insertOne(payment);
    
      const itemId = req.body.id;
      const query = { _id: new ObjectId(itemId) };
      const deleteResult = await selectedCollection.deleteOne(query);
    
      res.send({ insertResult, deleteResult });
    });
    
    
      

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res) =>{
    res.send('Photography is starting')
})

app.listen(port, () =>{
    console.log(`Photography is sitting on port ${port}`);
})