import express, { json } from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import joi from "joi"
import dayjs from "dayjs"

const app = express()

app.use(cors())
app.use(json())
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
  await mongoClient.connect()
  console.log("MongoDB connected.")
} catch (err) {
  (error) => console.log(error.message)
}

const db = mongoClient.db()

const participantsSchema = joi.object({
    name: joi.string().required()
})

// const messagesSchema = joi.object({
// 	to: joi.string().required(),
// 	text: joi.string().required(),
// 	type: joi.string().valid("message", "private_message").required()
// })

app.post("/participants", async (request, response) => {
  const { name } = request.body

  const validationParticipant = participantsSchema.validate( request.body, { abortEarly: false } )

  if (validationParticipant.error) {
    const errors = validationParticipant.error.details.map(detail => detail.message)
    return response.status(422).send(errors)
  }

  try {
    const participantExists = await db.collection("participants").findOne( { name } )
    if (participantExists) return response.status(409).send("Este nome de usuário já existe!")

    await db.collection("participants").insertOne({ name, lastStatus: Date.now() })
    await db.collection("messages").insertOne({
		from: name,
		to: "Todos",
		text: "entra na sala...",
		type: "status",
		time: dayjs().format("HH:mm:ss")
	})

    response.sendStatus(201)
  } catch (error) { response.status(500).send(error.message) }
})

app.get("/participants", async (request, response) => {

	try {
		const activeParticipants = await db.collection("participants").find().toArray()

		if (activeParticipants === undefined) {return response.status(404).send(activeParticipants)}
		response.send(activeParticipants)

	} catch (error) {response.status(500).send(error.message)}
})

app.post("/messages", async (request, response) => {
	const { to, text, type } = request.body
	const { user } = request.headers

	const messagesSchema = joi.object({
		to: joi.string().required(),
		text: joi.string().required(),
		type: joi.string().valid("message", "private_message").required()
	})

	const validationMessage = messagesSchema.validate( request.body, { abortEarly: false } )

	if (validationMessage.error) {
		const errors = validationMessage.error.details.map(detail => detail.message)
		return response.status(422).send(errors)
	}

	try {
		const participantIsActive = await db.collection("participants").findOne( { name: user } )

		if (!participantIsActive) { return response.sendStatus(422) }

		await db.collection("messages").insertOne( {
			from: user,
			to,
			text,
			type,
			time: dayjs().format("HH:mm:ss")
		} )
		response.sendStatus(201)

	} catch (error) { response.status(500).send(error.message) }
	
})

// app.post("/messages", async (request, response) => {
// 	const { to, text, type } = request.body
// 	const { user } = request.headers

// 	/* formato de uma mensagem:

// 		{
// 			from: 'João',
// 			to: 'Todos',
// 			text: 'oi galera',
// 			type: 'message',
// 			time: '20:04:37'
// 		}
// 	*/

// 	const validationMessages = schemaMessages.validate(request.body, {abortEarly: false})

// 	if (validationMessages.error) {
// 		const errors = validationMessages.error.details.map(detail => detail.message)
// 		return res.status(422).send(errors)
// 	}

// 	try {
// 		const activeParticipant = await db.collection("participants").findOne( {name: user } )

// 		console.log(activeParticipant)

// 		if (!activeParticipant || activeParticipant.name !== user) {return response.sendStatus(422)}

// 		await db.collection("messages").insertOne({from: user, to, text, type, time: dayjs().format("HH:mm:ss")})

// 		res.sendStatus(201)

// 	} catch (error) {response.status(500).send(error.message)}
// })

app.get("/messages", async (request, response) => {
	const { user } = request.headers
	const limit = parseInt(request.query.limit)

	try {
		const messagesForUser = await db.collection("messages").find({ $or: [ { type: "message" }, { to: user }, {from: user }, {to: "Todos"} ] })

		switch (limit) {
			case !limit:
				response.send(messagesForUser)
				break
			case limit > 0:
				const limitedMessages = messagesForUser.slice((limit))
				response.send(limitedMessages)
				break
			case limit <= 0:
				response.sendStatus(422)
				break
		};
	}  catch (error) {response.status(500).send(error.message)};
})

app.post("/status", async (request, response) => {
	const { user } = request.headers

	try {
		const activeParticipant = await db.collection("participants").findOne(user)

	if (!user || !activeParticipant) return response.sendStatus(404)

	await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
	response.sendStatus(200)

	} catch (error) {response.status(500).send(error.message)}
})

// function removeInactiveParticipants() {
// 	const currentTime = Date.now()
// 	const inactiveTimeLimit = currentTime - 15000
  
// 	const inactiveParticipants = await db.collection("participants").find({ lastStatus: { $lt: inactiveTimeLimit } })

// 	Participants.remove({ _id: { $in: inactiveParticipants.map(participant => participant._id) } })

// 	inactiveParticipants.forEach(participant => {
// 	  const message = {from: participant.name, to, text: "sai da sala...", type, time: dayjs().format("HH:mm:ss")}

// 		await db.collection("messages").insertOne(message)
// 	  } catch (error) {res.status(500).send(error.message)}
// 	})
// }
  
// setInterval(removeInactiveParticipants, 15000)

const PORT = 5000
app.listen(PORT, () => console.log(`Server active on port ${PORT}.`))
