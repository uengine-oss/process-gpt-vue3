const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// 빌드된 파일이 있는 디렉토리를 정적 파일로 제공
app.use(express.static(path.join(__dirname, 'dist')));

// 모든 요청을 index.html로 리디렉션
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});