const express = require('express');
const app = express();

app.use(express.static(__dirname + '/public')); //Serves resources from public folder

app.listen(4000, () => console.log('Server listening on port 4000!'));