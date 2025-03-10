const { v4: uuidV4 } = require('uuid')
const express = require('express')
const { ExpressPeerServer } = require('peer');
const app = express()
const fs = require('fs')
const https = require('https');
const { Server } = require('http');
const options = {
  key:fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
}
const httpsServer = https.createServer(options, app)
const io = require('socket.io')(httpsServer)
const peerServer = ExpressPeerServer(httpsServer, {
  debug: true
});

app.set('view engine', 'ejs')
app.use('/peerjs', peerServer);
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.redirect(`/${uuidV4()}`)
})

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room })
})

io.on('connection', socket => {
  socket.on('join-room', (roomId, userId) => {
    console.log('user connected')
    socket.join(roomId)
    socket.to(roomId).broadcast.emit('user-connected', userId)

    socket.on('disconnect', () => {
      console.log('user disconnected')
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
  })
})

httpsServer.listen(3001)
//httpsServer.listen(443, function () {console.log("Example app listening at https://%s:%s", httpsServer.address().address, httpsServer.address().port);});
