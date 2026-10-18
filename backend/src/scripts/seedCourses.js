import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Course from '../models/Course.js';
import User from '../models/User.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const courses = [
  ['python-for-everybody','Python for Everybody','Python','Beginner',8,'weeks','Free',0,['Python','Programming'],[],'freeCodeCamp','https://www.freecodecamp.org/learn/scientific-computing-with-python/','Build a foundation in Python syntax, data structures, and problem solving.'],
  ['intro-python-kaggle','Intro to Programming','Python','Beginner',5,'hours','Free',0,['Python','Programming'],[],'Kaggle','https://www.kaggle.com/learn/intro-to-programming','Practice Python fundamentals through short interactive exercises.'],
  ['data-analysis-python','Data Analysis with Python','NumPy & Pandas','Beginner',6,'weeks','Free',0,['NumPy','Pandas','Data cleaning'],['Python'],'freeCodeCamp','https://www.freecodecamp.org/learn/data-analysis-with-python/','Explore data analysis with Python libraries and practical datasets.'],
  ['google-data-analytics','Google Data Analytics Professional Certificate','Data Analysis','Beginner',6,'months','Paid',0,['Spreadsheets','SQL','Data visualization'],[],'Google / Coursera','https://www.coursera.org/professional-certificates/google-data-analytics','Study foundational data analytics practices in a guided program.'],
  ['sql-kaggle','Intro to SQL','Data Analysis','Beginner',3,'hours','Free',0,['SQL','Databases','Queries'],[],'Kaggle','https://www.kaggle.com/learn/intro-to-sql','Practice SQL queries for exploring and analyzing data.'],
  ['pandas-kaggle','Pandas','NumPy & Pandas','Beginner',4,'hours','Free',0,['Pandas','Data frames','Data analysis'],['Python'],'Kaggle','https://www.kaggle.com/learn/pandas','Learn common data manipulation tasks with Pandas.'],
  ['ml-intro-kaggle','Intro to Machine Learning','Machine Learning','Beginner',3,'hours','Free',0,['Pandas','Model validation','Decision trees'],['Python'],'Kaggle','https://www.kaggle.com/learn/intro-to-machine-learning','Use scikit-learn to build and validate introductory models.'],
  ['ml-specialization','Machine Learning Specialization','Machine Learning','Intermediate',3,'months','Paid',0,['Supervised learning','Neural networks','Python'],['Python','Algebra'],'DeepLearning.AI / Stanford Online','https://www.coursera.org/specializations/machine-learning-introduction','A practical introduction to modern machine learning concepts.'],
  ['deep-learning-specialization','Deep Learning Specialization','Deep Learning','Advanced',5,'months','Paid',0,['Neural networks','TensorFlow','Computer vision'],['Machine learning'],'DeepLearning.AI / Coursera','https://www.coursera.org/specializations/deep-learning','Study neural networks and their applications in vision and sequence modeling.'],
  ['pytorch-tutorials','Learn PyTorch','Deep Learning','Intermediate',1,'self-paced','Free',0,['PyTorch','Deep learning','Python'],['Python'],'PyTorch','https://pytorch.org/tutorials/','Follow official tutorials to build and train neural networks with PyTorch.'],
  ['huggingface-nlp','NLP Course','NLP','Intermediate',1,'self-paced','Free',0,['Transformers','NLP','Hugging Face'],['Python'],'Hugging Face','https://huggingface.co/learn/nlp-course','Learn how transformer models are used for natural language processing.'],
  ['intro-generative-ai','Introduction to Generative AI','Generative AI','Beginner',1,'days','Free',0,['Generative AI','LLMs','Prompting'],[],'Google Cloud Skills Boost','https://www.cloudskillsboost.google/paths/118','An introductory overview of generative AI concepts and applications.'],
  ['generative-ai-google','Generative AI Learning Path','Generative AI','Beginner',1,'self-paced','Free',0,['Generative AI','Large language models','Responsible AI'],[],'Google Cloud Skills Boost','https://www.cloudskillsboost.google/paths/118','Explore introductory learning content about generative AI on Google Cloud.'],
  ['learn-react','Learn React','Web Development','Beginner',1,'self-paced','Free',0,['React','JavaScript','UI'],['JavaScript'],'Scrimba','https://scrimba.com/learn/learnreact','Create interactive interfaces using React components and state.'],
  ['mdn-web-development','MDN Learn Web Development','Web Development','Beginner',1,'self-paced','Free',0,['HTML','CSS','JavaScript'],[],'MDN','https://developer.mozilla.org/en-US/docs/Learn','A structured set of modules for core web development skills.'],
  ['aws-cloud-practitioner','AWS Cloud Practitioner Essentials','Cloud Computing','Beginner',6,'hours','Free',0,['Cloud','AWS','Architecture'],[],'AWS Skill Builder','https://skillbuilder.aws/learn/Cloud%20Practitioner%20Essentials','Understand core AWS cloud concepts and services.'],
  ['azure-fundamentals','Azure Fundamentals','Cloud Computing','Beginner',1,'self-paced','Free',0,['Cloud','Azure','Security'],[],'Microsoft Learn','https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/','Explore cloud concepts and foundational Azure services.'],
  ['intro-cybersecurity','Introduction to Cybersecurity','Cybersecurity','Beginner',6,'hours','Free',0,['Security','Threats','Risk'],[],'Cisco Networking Academy','https://www.netacad.com/courses/introduction-to-cybersecurity','Discover cybersecurity principles, threats, and career pathways.'],
  ['ibm-cybersecurity','IBM Cybersecurity Analyst Professional Certificate','Cybersecurity','Beginner',8,'months','Paid',0,['Cybersecurity','Threat analysis','Incident response'],[],'IBM / Coursera','https://www.coursera.org/professional-certificates/ibm-cybersecurity-analyst','Explore cybersecurity topics through a structured online program.'],
  ['git-github','Introduction to GitHub','Web Development','Beginner',1,'hours','Free',0,['Git','GitHub','Version control'],[],'GitHub Skills','https://skills.github.com/','Practice version control workflows using GitHub learning exercises.'],
];

await connectDatabase();
try {
  const operations = courses.map(([slug,title,category,level,duration,durationUnit,priceType,price,skills,prerequisites,provider,externalUrl,description]) => ({
    updateOne: { filter: { slug }, update: { $set: {
      slug,title,category,level,duration,durationUnit,priceType,price,currency:'USD',skills,prerequisites,
      description,provider,externalUrl,image:'',published:true,
      learningOutcomes: skills.map((skill) => `Understand and practice ${skill}.`),
    } }, upsert: true },
  }));
  const result = await Course.bulkWrite(operations, { ordered: false });
  console.log(`Course seed complete. Inserted ${result.upsertedCount}; updated ${result.modifiedCount}.`);

  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    if (process.env.SEED_ADMIN_PASSWORD.length < 8) throw new Error('SEED_ADMIN_PASSWORD must contain at least 8 characters.');
    const email = process.env.SEED_ADMIN_EMAIL.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12);
    await User.updateOne({ email }, { $set: { email, name: process.env.SEED_ADMIN_NAME || 'Course Administrator', passwordHash, role: 'admin', emailVerified: true }, $setOnInsert: { currentSkills: [], interests: [] } }, { upsert: true });
    console.log(`Admin account provisioned for ${email}.`);
  }
} finally {
  await disconnectDatabase();
  await mongoose.connection.close();
}
