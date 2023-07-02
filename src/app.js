import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();

app.use(cors());
app.use(json());
dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
  console.log("MongoDB connect.");
} catch (err) {
  (err) => console.log(err.message);
}

const db = mongoClient.db();

app.post("/participants", async (req, res) => {
  const { name } = req.body; /* recebendo objeto do cliente */

  const schemaParticipants = joi.object({
    name: joi.string().required()
  });
  /* formato do objeto para validação */

  const validationParticipant = schemaParticipants.validate(req.body, {abortEarly: false});

  if (validationParticipant.error) {
    const errors = validationParticipant.error.details.map((detail) => detail.message); /* tratamento da validação participants */
    console.log(errors);
    return res.sendStatus(422);
  }

  try {
    const participant = await db.collection("participants").findOne({ name: name }); /* condição de participante existente */
    if (participant) return res.sendStatus(409);

    await db.collection("participants").insertOne({ name: name, lastStatus: Date.now() });
    await db.collection("messages").insertOne({
		from: name,
		to: "Todos",
		text: "entra na sala...",
		type: "status",
		time: dayjs().format("HH:mm:ss")
	  });

    res.sendStatus(201); /* enviando resposta para o cliente */
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("participants", async (req, res) => {

	try {
		const activeParticipants = await db.collection("participants").find().toArray();

		if (activeParticipants === undefined) {return res.status(404).send("[]")};
		res.send(activeParticipants);

	} catch (error) {res.status(500).send(error.message)};
});

app.post("messages", async (req, res) => {
	const { to, text, type } = req.body;
	const { User } = req.headers;

	const schemaMessages = joi.object({
		to: joi.string().required(),
		text: joi.string().required(),
		type: joi.string().valid("message", "private_message").required()
	});

	const validationMessages = schemaMessages.validate(req.body, {abortEarly: false});

	if (validationMessages.error) {
		const errors = validationMessages.error.details.map((detail) => detail.message);
		console.log(errors);
		return res.sendStatus(422);
	};

	try {
		const activeParticipant = await db.collection("participants").findOne({ User }).toArray();

		if (!activeParticipant) {return res.sendStatus(404)};

		await db.collection("messages").insertOne({
			from: User,
			to: to,
			text: text,
			type: type,
			time: dayjs().format("HH:mm:ss")
		  });

		res.sendStatus(201);

	} catch (error) {res.status(500).send(error.message)};
});

app.get("messages", async (req, res) => {
	const { User } = req.headers;
	const limit = parseInt(req.query.limit);

	try {
		const messagesForUser = await db.messages.find( { $or: [ { type: "message" }, { to: User }, {from: User } ] } );

		switch (limit) {
			case !limit:
				res.send(messagesForUser);
				break;
			case limit > 0:
				const limitedMessages = messagesForUser.slice((limit));
				res.send(limitedMessages);
				break;
			case limit <= 0:
				res.sendStatus(422);
				break;
		};
	}  catch (error) {res.status(500).send(error.message)};
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server active on port ${PORT}.`));
