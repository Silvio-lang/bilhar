const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let jogadoresConectados = 0;
let jogador1SocketId = null;
let jogador2SocketId = null;
let mesaBloqueada = false; // Controle do bloqueio de treino

let estadoJogo = {
    pontosJ1: 0,
    pontosJ2: 0,
    jogadorAtual: 1
};

io.on('connection', (socket) => {
    let numeroJogadorAtribuido = 0;

    if (jogadoresConectados === 0) {
        jogadoresConectados = 1;
        jogador1SocketId = socket.id;
        numeroJogadorAtribuido = 1;
    } else if (jogadoresConectados === 1 && !mesaBloqueada) {
        jogadoresConectados = 2;
        jogador2SocketId = socket.id;
        numeroJogadorAtribuido = 2;
    } else {
        numeroJogadorAtribuido = 0; // Espectador
    }

    socket.emit('atribuirJogador', { 
        numeroJogador: numeroJogadorAtribuido,
        mesaBloqueada: mesaBloqueada,
        jogadoresConectados: jogadoresConectados
    });

    if (jogadoresConectados === 2 && !mesaBloqueada) {
        // Reseta o jogo ao entrar o segundo jogador
        estadoJogo.pontosJ1 = 0;
        estadoJogo.pontosJ2 = 0;
        estadoJogo.jogadorAtual = 1;
        io.emit('jogoPronto');
        io.emit('jogoReiniciado', estadoJogo);
    }

    socket.on('alternarTravaMesa', (bloqueado) => {
        if (socket.id === jogador1SocketId) {
            mesaBloqueada = bloqueado;
            io.emit('statusTravaAtualizado', { mesaBloqueada });
        }
    });

    socket.on('realizarTacada', (dados) => {
        io.emit('executarTacada', dados);
    });

    socket.on('notificarSincronizacao', (dados) => {
        socket.broadcast.emit('sincronizarPosicoes', dados);
    });

    socket.on('notificarPonto', (dados) => {
        estadoJogo.pontosJ1 = dados.pontosJ1;
        estadoJogo.pontosJ2 = dados.pontosJ2;
        io.emit('atualizarPlacar', estadoJogo);
    });

    socket.on('solicitarReinicio', () => {
        estadoJogo.pontosJ1 = 0;
        estadoJogo.pontosJ2 = 0;
        estadoJogo.jogadorAtual = 1;
        io.emit('jogoReiniciado', estadoJogo);
    });

    socket.on('disconnect', () => {
        if (socket.id === jogador1SocketId) {
            jogador1SocketId = jogador2SocketId;
            jogador2SocketId = null;
            if (jogadoresConectados > 0) jogadoresConectados--;
        } else if (socket.id === jogador2SocketId) {
            jogador2SocketId = null;
            jogadoresConectados = 1;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});