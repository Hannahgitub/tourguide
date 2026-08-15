const fs = require('fs');

const dataContent = fs.readFileSync('data.js', 'utf8');
const match = dataContent.match(/window\.data\s*=\s*(\{[\s\S]*?\});?\s*$/);
const dataObj = match ? JSON.parse(match[1]) : {};
const dataQuestions = dataObj.questions || [];

let questionsJson = [];
if (fs.existsSync('questions.json')) {
  questionsJson = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
}

console.log('dataQuestions length:', dataQuestions.length);
console.log('questionsJson length:', questionsJson.length);

const targetInData = dataQuestions.find(q => (q.enQuestion || q.question || '').includes('strong work abilities'));
console.log('target in data.js:', targetInData ? { id: targetInData.id, q: targetInData.question, enQ: targetInData.enQuestion } : 'not found');

const targetInJson = questionsJson.find(q => (q.enQuestion || q.question || '').includes('strong work abilities'));
console.log('target in questions.json:', targetInJson ? { id: targetInJson.id, q: targetInJson.question, enQ: targetInJson.enQuestion } : 'not found');

// 找 id 为 23 和 46 的题目
console.log('data id 23:', dataQuestions.find(q => q.id === 23));
console.log('data id 46:', dataQuestions.find(q => q.id === 46));
console.log('json id 23:', questionsJson.find(q => q.id === 23));
console.log('json id 46:', questionsJson.find(q => q.id === 46));
