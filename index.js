import express from "express";
import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import cors from "cors";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

const app = express();

const model = new AzureChatOpenAI({ temperature: 0.2 });
let Allmessages = [];
let vectorStore

const embeddings = new AzureOpenAIEmbeddings({
  temperature: 0,
  azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});

vectorStore = await FaissStore.load("vectordatabase", embeddings);

async function createVectorstore() {
  const loader = new TextLoader("roles.txt");
  console.log("LOADER: ", loader);
  const docs = await loader.load();
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log(
    `Document split into ${splitDocs.length} chunks. Now saving into vector store`
  );
  
  // vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
  vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
  await vectorStore.save("./vectordatabase");
}

async function askQuestion(question){
  const relevantDocs = await vectorStore.similaritySearch(question,3);
  const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");
  const response = await model.invoke([
      ["system", "Use the following context to answer the user's question. Only use information from the context."],
      ["user", `Context: ${context}\n\nQuestion: What is this document about?`]
  ]);
  console.log('relevantDocs: ', relevantDocs); 
  console.log('context: ', context); 
  
  console.log("\nAnswer found:");
  console.log(response.content);
  return response.content
}

app.use(cors());
app.use(express.json());

app.get("/create", async (req, res) => {
  createVectorstore()
  
});
app.get("/test", async (req, res) => {
  askQuestion()
  
});

app.post("/chat", async (req, res) => {
  const question = req.body.q;
  const context = req.body.history;
  const response = await fetch("https://api.opendota.com/api/heroes", {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
 
  console.log(vectorStore)

  Allmessages.push(["user", question]);
  const message = [
    new SystemMessage(
      `Your a fantasy dwarf that wil awnser the following question about Dota 2: ${question} but keep it short. If the question is about a role use the following data for information about the different possitions: ${askQuestion(question)}. you can use information from this webservice aswell: ${await response.json()}`
    ),
  ];


  for (const { human, ai } of context) {
    message.push(new HumanMessage(human));
    message.push(new AIMessage(ai));
  }


  message.push(new HumanMessage(question));

  const chat1 = await model.stream(message);

  res.setHeader("Content-Type", "text/plain");
  for await (const chunk of chat1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(chunk.content);
    res.write(chunk.content);
  }

  res.end();
});

app.listen(process.env.EXPRESS_PORT, () => {
  console.log(`Server is listening on port ${process.env.EXPRESS_PORT}`);
});
