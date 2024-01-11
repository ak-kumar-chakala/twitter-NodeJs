const bcrypt = require("bcrypt");
const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "twitterClone.db");

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("server initialized");
    });
  } catch (e) {
    console.log(e.message);
  }
};
initializeDbAndServer();

app.post("/register", async (request, response) => {
  console.log(request.body);
  const { username, name, password, gender } = request.body;
  userAlreadyExistsQuery = `
    SELECT *
    FROM USER
    WHERE userName='${username}'`;

  const DbResult = await db.get(userAlreadyExistsQuery);

  if (DbResult === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const addUserQuery = `
        INSERT INTO USER(username,name,password,gender)
        VALUES('${username}','${name}','${hashedPassword}','${gender}');`;
      await db.run(addUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(request.body);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getQuery = `
    SELECT *
    FROM USER LEFT JOIN FOLLOWER ON USER.user_id= follower.follower_user_id
    WHERE username='${username}';`;

  const result = await db.all(getQuery);

  const id_of_following_users = result.map((eachPerson) => ({
    id: eachPerson.following_user_id,
  }));
  console.log(id_of_following_users);

  let resultArray = [];

  for (let eachItem of id_of_following_users) {
    const getFollowingQuery = `

    SELECT *
    FROM USER
    where user_id='${eachItem.id}';
    
    `;

    let followingName = await db.get(getFollowingQuery);
    console.log(followingName);
    resultArray.push({
      name: followingName.name,
    });
  }
  response.send(resultArray);
});
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;

  const getQuery = `
    SELECT *
    FROM USER LEFT JOIN FOLLOWER ON USER.user_id= follower.following_user_id
    WHERE username='${username}';`;

  const result = await db.all(getQuery);

  const id_of_following_users = result.map((eachPerson) => ({
    id: eachPerson.follower_user_id,
  }));
  console.log(id_of_following_users);

  let resultArray = [];

  for (let eachItem of id_of_following_users) {
    console.log(eachItem);
    const getFollowingQuery = `

    SELECT name
    FROM USER
    where user_id='${eachItem.id}';
    
    `;
    let followingName = await db.get(getFollowingQuery);
    console.log(followingName);
    resultArray.push({
      name: followingName.name,
    });
  }
  response.send(resultArray);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  console.log(tweetId);

  const getQuery = `
    SELECT *
    FROM USER LEFT JOIN FOLLOWER ON USER.user_id= follower.follower_user_id
    WHERE username='${username}';`;

  const result = await db.all(getQuery);

  const id_of_following_users = result.map((eachPerson) => ({
    id: eachPerson.following_user_id,
  }));

  let resultArray = [];

  for (let eachItem of id_of_following_users) {
    resultArray.push(eachItem.id);
  }
  console.log(resultArray);

  const getTweet = `
  SELECT tweet,COUNT(like_id) AS likes,COUNT(reply_id) AS replies,tweet.date_time AS dateTime,tweet.user_id
  FROM (TWEET LEFT JOIN LIKE ON tweet.tweet_id=like.tweet_id ) AS T
  LEFT JOIN reply ON  tweet.tweet_id=reply.reply_id
  WHERE tweet.tweet_id=${tweetId};`;

  const resultTweet = await db.get(getTweet);
  console.log(resultTweet);
  console.log(resultArray.includes(resultTweet.user_id));

  if (resultArray.includes(resultTweet.user_id)) {
    response.send({
      tweet: resultTweet.tweet,
      likes: resultTweet.likes,
      replies: resultTweet.replies,
      dateTime: resultTweet.dateTime,
    });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;

    const getQuery = `
    SELECT *
    FROM USER LEFT JOIN FOLLOWER ON USER.user_id= follower.follower_user_id
    WHERE username='${username}';`;

    const result = await db.all(getQuery);

    const id_of_following_users = result.map((eachPerson) => ({
      id: eachPerson.following_user_id,
    }));

    let resultArray = [];

    for (let eachItem of id_of_following_users) {
      resultArray.push(eachItem.id);
    }
    console.log(resultArray);

    const getTweet = `
    SELECT tweet.tweet_id,tweet.user_id AS tweeter_id,like.user_id AS liker_id
    FROM tweet left join like on tweet.tweet_id=like.tweet_id
    WHERE tweet.tweet_id=${tweetId};`;

    const resultTweet = await db.all(getTweet);
    console.log(resultTweet);
    const likerId = resultTweet.map((eachItem) => eachItem.liker_id);

    const likes = [];

    for (let eachItem of likerId) {
      const getUserName = `
        SELECT *
        FROM USER
        WHERE USER.user_id=${eachItem};`;

      let result = await db.get(getUserName);

      likes.push(result.name);
    }

    if (resultArray.includes(resultTweet[1].tweeter_id)) {
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserId = `
    SELECT user.user_id 
    FROM USER
    WHERE username='${username}';`;

  const result = await db.get(getUserId);
  const userId = result.user_id;

  const getQuery = `
    SELECT username,tweet,date_time as dateTime 
  FROM (FOLLOWER INNER JOIN USER ON FOLLOWER.following_user_id=USER.user_id)AS T
  INNER JOIN TWEET ON TWEET.user_id=T.following_user_id 
  WHERE follower.follower_user_id=${userId}
  ORDER BY tweet.date_time DESC
  LIMIT 4
  ;`;

  const result1 = await db.all(getQuery);
  response.send(result1);
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;

    const getUserId = `
    SELECT user_id
    FROM USER
    WHERE username='${username}';`;

    const result1 = await db.get(getUserId);
    const user_id = result1.user_id;
    console.log(user_id);

    const { tweetId } = request.params;
    const getTweet = `
    SELECT user_id
    FROM TWEET
    WHERE tweet_id='${tweetId}';
    `;
    const result2 = await db.get(getTweet);
    const tweet_user_id = result2.user_id;

    if (tweet_user_id === user_id) {
      const DeleteQuery = `
        DELETE FROM TWEET
        WHERE tweet_id=${tweetId};`;

      await db.run(DeleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;

  const postQuery = `
  INSERT INTO TWEET(tweet)
  VALUES('${tweet}');`;

  await db.run(postQuery);
  response.send("Created a Tweet");
});

app.get("/user/tweets", authenticateToken, async (request, response) => {
  const { username } = request;

  const getId = `
SELECT user_id
FROM USER
WHERE username='${username}' `;

  const result1 = await db.get(getId);
  const userId = result1.user_id;

  const getTweet = `
  SELECT tweet, COUNT(DISTINCT like_id) AS likes ,COUNT(DISTINCT reply_id) AS replies,tweet.date_time AS dateTime
  FROM (TWEET LEFT JOIN LIKE ON TWEET.tweet_id=LIKE.tweet_id) LEFT JOIN REPLY ON reply.tweet_id=tweet.tweet_id 
  WHERE tweet.user_id=${userId};`;

  const result2 = await db.all(getTweet);

  response.send(result2);
});

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;

    const getQuery = `
    SELECT *
    FROM USER LEFT JOIN FOLLOWER ON USER.user_id= follower.follower_user_id
    WHERE username='${username}';`;

    const result = await db.all(getQuery);

    const id_of_following_users = result.map((eachPerson) => ({
      id: eachPerson.following_user_id,
    }));

    let resultArray = [];

    for (let eachItem of id_of_following_users) {
      resultArray.push(eachItem.id);
    }
    console.log(resultArray);

    const getTweet = `
    SELECT tweet.tweet_id,tweet.user_id AS tweeter_id,reply.user_id AS reply_id
    FROM tweet left join reply on tweet.tweet_id=reply.tweet_id
    WHERE tweet.tweet_id=${tweetId};`;

    const resultTweet = await db.all(getTweet);
    console.log(resultTweet);
    const likerId = resultTweet.map((eachItem) => eachItem.reply_id);

    const likes = [];

    for (let eachItem of likerId) {
      const getUserName = `
        SELECT *
        FROM USER
        WHERE USER.user_id=${eachItem};`;

      let result = await db.get(getUserName);

      likes.push(result.name);
    }

    if (resultArray.includes(resultTweet[1].tweeter_id)) {
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
