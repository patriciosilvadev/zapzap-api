const { Router } = require('express');
const Sessions = require("../sessions");
const fs = require('fs');
const real_path = require('path');

//const bcrypt = require("bcrypt-nodejs");
//const jwt = require('jsonwebtoken');
//const passport = require('passport');
//require('../configurations/password')(passport);
//const controllers = require('../controllers');

const router = Router();

const User = require('../models/user');

function delete_token(path){
  if(fs.existsSync(path)) {
    fs.rmdirSync(path, {recursive: true})
  }else{
    try {
      fs.unlinkSync(path);
    } catch(err) {
      console.error(err)
    }
  }

}

router.post('/user/save', function(req, res) {
  if (!req.body.username || !req.body.password) {
    res.status(400).send({
      status: false,
      message: ''
    });
  } else {
    User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      session_key: req.body.username + '-' + getRandomString(10),

      //first_name: req.body.first_name,
      //last_name: req.body.last_name,
      //active: req.body.active,
      //admin: req.body.admin

    }).then((user) => res.status(201).send(user)).catch((error) => {
      res.status(400).send(error);
    });
  }

  function getRandomString(length) {
    let randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for ( let i = 0; i < length; i++ ) {
      result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
  }
});

router.post('/user/login', function (req, res) {
  async function check_user() {
    const user = await User.findOne({where: {username: req.body.username}});
    if (!user) {
      return res.json({success: false, message: "Usuário não existe!"});
    } else {
      User.comparePassword(req.body.password, user, (err, isMatch) =>{
        if (!isMatch){
          return res.json({success: false, message: "Senha inválida!!!"});
        }
        return res.json({sucess: true, message: "Login efetuado com sucesso.", key: user.session_key, user_id: user.id});
      });

      //const passwordHash = bcrypt.compare(req.body.password, user.password, function(err, res) {
        //if(res) {
          //console.log('Your password mached with database hash password');
        //} else {
          //console.log('Your password not mached.');
        //}
      //});

      //console.log(passwordHash + '  ' + user.password)
      //if (passwordHash === user.password) {
        //res.send('You are logged in!');
      //} else {
        //console.log('incorrect password');
      //}
    }
  }

  check_user().then(r => {});

  /*user.generateToken((err, user)=>{
    if(err) return res.status(400).json({error: err});
    res.cookie("x-auth", user.token).status(200).json({
        message:"Login Success"
    })
  })*/
})

router.post('/user/delete', async function (req, res) {
  await Sessions.closeSession(req.body.sessionName);

  delete_token(real_path.join('./tokens/' + req.body.sessionName + '.data.json'));

  User.destroy({
    where: {
      id: req.body.user_id
    }
  }).then(function (deletedRecord) {
    if(deletedRecord === 1){
      res.status(200).json({success: true, message:"Usuário removido com sucesso!!!"});
    } else {
      res.status(404).json({success: false, message:"Erro ao remover usuário."})
    }
  }).catch(function (error) {
    res.status(500).json(error);
  })
})

router.get('/database/reset', function (req, res) {
  delete_token(real_path.join('./tokens'));

  User.destroy({
    where: {
    }
  }).then(function (deletedRecord) {
    if(deletedRecord){
      res.status(200).json({success: true, message:"Banco de dados resetado com sucesso!!!"});
    } else {
      res.status(404).json({success: false, message:"Erro ao resetar banco de dados."})
    }
  }).catch(function (error) {
    res.status(500).json(error);
  })
})

router.get('/database/load', function (req, res) {

  User.findAll().then(function (load_data) {
    if(load_data){
      res.status(200).json({success: true, object: load_data, message:"Banco de dados carregado com sucesso!!!"});
    } else {
      res.status(404).json({success: false, message:"Erro ao carregar banco de dados."})
    }
  }).catch(function (error) {
    res.status(500).json(error);
  })
})

router.get("/start", async (req, res, next) => {
  console.log("starting..." + req.query.sessionName);
  const session = await Sessions.start(req.query.sessionName);

  if (["CONNECTED", "QRCODE", "STARTING"].includes(session.state)) {
    res.redirect("../api/qrcode?sessionName=" + req.query.sessionName + '&image=true')
  } else {
    res.status(200).json({ result: 'error', message: session.state });
  }
  return res.end();
});

router.get("/new_qrcode", async function (req, res, next) {
  const session = await Sessions.getSession(req.query.sessionName);
  if (session) {
    if (session.status === 'qrReadSuccess'){
      return res.json({success: 'true', object: false, message: 'Já está logado!!!', is_active: true});
    }
    console.log('OLHA AI O STATUS: ' + session.status + ' E OLHA O STATE: ' + session.state);
    if (session.status === 'inChat'){
      //res.redirect('/testing');
      return res.json({success: 'true', object: false, message: 'Já está logado!!!', is_active: true});
    }else if (session.status === 'notLogged') {
      res.json({success: 'true', object: session.qrcode, message: 'Novo qrcode gerado com sucesso!!!'});
    }
  } else {
    console.log('NÃO TEM SESSÃO...')
    res.json({success: "false", message: "NOTFOUND" });
  }
});

router.get("/qrcode", async (req, res, next) => {
  console.log("qrcode..." + req.query.sessionName);
  const session = Sessions.getSession(req.query.sessionName);
  if (session !== false) {
    if (session.status === 'notLogged') {
      if (req.query.image) {
        res.redirect('/zapzap');
      } else {
        res.status(200).json({result: "success", message: session.state, qrcode: session.qrcode});
      }
    } else if (session.status === 'inChat') {
      res.redirect('/testing');
    }
  } else {
    res.status(200).json({ result: "error", message: session.state });
  }
});

router.post("/sendText", async function sendText(req, res, next) {
  const result = await Sessions.sendText(
    req.body.sessionName,
    req.body.number,
    req.body.text
  );
  res.json(result);
});

router.get("/sendText", async (req, res, next) => {
  const result = await Sessions.sendText(
    req.query.sessionName,
    req.query.number,
    req.query.text
  );
  res.json(result);
});

router.post("/sendFile", async (req, res, next) => {
  const result = await Sessions.sendFile(
    req.body.sessionName,
    req.body.number,
    req.body.base64Data,
    req.body.fileName,
    req.body.caption
  );
  res.json(result);
});

router.get("/messages/unread", async function (req, res, next) {
  const result = await Sessions.unreadMessages(req.query.sessionName);
  res.json(result);
});

router.get("/close", async (req, res, next) => {
  const result = await Sessions.closeSession(req.query.sessionName);
  res.json(result);
});

module.exports = router;