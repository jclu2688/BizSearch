//init
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const fs = require("fs");
const axios = require("axios");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static("public"));

//init sqlite db
const dbFile = "./.data/sqlite.db";
const exists = fs.existsSync(dbFile);
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(dbFile);

app.get("/", (request, response) => {
  response.sendFile(`${__dirname}/views/index.html`);
});

//static routing
app.use("/pages",express.static(`${__dirname}/views/pages`));
app.use("/views",express.static(`${__dirname}/views`));

//endpoint to get all businesses in database
app.get("/getBusiness", (request, response) => {
  db.all(`SELECT * FROM Businesses WHERE id = (?)`, request.query.id, (err, rows) => {
    if ( err ) throw err;
    response.send(JSON.stringify(rows));
  });
});

//add business to db
app.get("/signUp", (request, response) => {
  var id = Math.floor(Math.random() * 1e9);
  db.run(
    `INSERT INTO Businesses VALUES ((?),(?),(?),(?),(?),(?),(?),(?),(?),(?),(?),(?),(?))`,
    id,
    request.query.name,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    err => {
      if ( err ) throw err;
      db.run(
        `INSERT INTO Analytics VALUES ((?),(?),(?),(?),(?))`,
        id,
        null,
        null,
        null,
        0,
        err => {
          bcrypt.hash(request.query.password,10,function(err,hash) {
            if ( err ) throw err;
            db.run(
              `INSERT INTO Users VALUES ((?),(?),(?),(?))`,
              id,
              request.query.username,
              hash,
              "",
              err => {
                if ( err ) throw err;
                response.redirect(`/pages/bizprofile.html?id=${id}`);
              }
            );
          });
        }
      );
    }
  );
});

app.get("/login",(request,response) => {
  db.all(`SELECT hash FROM Users WHERE username = (?)`,request.query.username,(err,rows) => {
    if ( err ) throw err;
    if ( rows.length == 0 ) return response.send("fail");
    var hash = rows[0].hash;
    console.log(hash,request.query.password);
    bcrypt.compare(request.query.password,hash,(err,result) => {
      if ( err ) throw err;
      if ( result ) {
        crypto.randomBytes(32,function(err,buffer) {
          if ( err ) throw err;
          var token = buffer.toString("hex");
          db.run("UPDATE Users SET tokens = (?) WHERE username = (?)",token,request.query.username,err => {
            if ( err ) throw err;
            response.send(token);
          });
        });
      } else {
        response.send("fail");
      }
    })
  });
})

//search bar function
app.get("/search",(request,response) => {
  request.query.search
  db.all("SELECT * FROM Businesses",(err,rows) => {
    if ( err ) throw err;
    var matches = [];
    console.log(rows);
    for ( var i in rows ) {
      if ( (rows[i].tags || "").indexOf(cleanString(request.query.search)) > -1 ) matches.push(rows[i]);
    }
    //get ip, get location
    var ip = request.headers["x-forwarded-for"] || request.connection.remoteAddress;
    axios.get(`http://api.ipstack.com/${ip.split(",")[0]}?access_key=44d8862c96df6317381286de7e139c53&format=1`).then(ipData => {
      for ( var i in matches ) {
        //find distance
        matches[i].distance = Math.hypot(ipData.data.latitude - matches[i].lat,ipData.data.longitude - matches[i].long);
      }
      //return sorted array of businesses by distance
      var out = matches.sort((a,b) => a.distance - b.distance);
      response.send(out);
    });
  });
});

app.get("/submitSurvey",(request,response) => {
  var id = request.query.id;
  var ip = request.headers["x-forwarded-for"] || request.connection.remoteAddress;
  db.run(
    `INSERT INTO Feedback VALUES ((?),(?),(?),(?),(?),(?))`,
    id,
    request.query.obj,
    request.query.rating,
    request.query.price,
    request.query.email,
    ip,
    err => {
      if ( err ) throw err;
      response.redirect(`/pages/bizprofile.html?id=${id}`)
    }
  );
});

//prevent sql injections
const cleanString = function(string){
  return string.replace(/</g, "&lt").replace(/>/g, "&gt");
};

//listening
var listener = app.listen(process.env.PORT, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});