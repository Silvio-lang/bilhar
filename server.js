const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let jogadoresConectados = [];
let estadoJogo = {
    pontosJ1: 0,
    pontosJ2: 0,
    jogadorAtual: 1,
    discoMaior: { x: 400, y: 50 },
    discoMenor: { x: 400, y: 225 }
};

io.on('connection', (socket) => {
    console.log(`Novo jogador conectado: ${socket.id}`);

    if (jogadoresConectados.length < 2) {
        const numeroJogador = jogadoresConectados.length + 1;
        jogadoresConectados.push({ id: socket.id, numero: numeroJogador });
        
        socket.emit('atribuirJogador', { numeroJogador });
        console.log(`Jogador ${numeroJogador} atribuído para ${socket.id}`);
    } else {
        socket.emit('atribuirJogador', { numeroJogador: 0 });
    }

    if (jogadoresConectados.length === 2) {
        io.emit('jogoPronto', { estadoJogo });
    }

    socket.on('realizarTacada', (dadosTacada) => {
        estadoJogo.jogadorAtual = dadosTacada.proximoJogador;
        io.emit('executarTacada', dadosTacada);
    });

    socket.on('notificarPonto', (dadosPonto) => {
        estadoJogo.pontosJ1 = dadosPonto.pontosJ1;
        estadoJogo.pontosJ2 = dadosPonto.pontosJ2;
        io.emit('atualizarPlacar', estadoJogo);
    });

    socket.on('notificarSincronizacao', (dadosPosicao) => {
        socket.broadcast.emit('sincronizarPosicoes', dadosPosicao);
    });

    socket.on('solicitarReinicio', () => {
        estadoJogo.pontosJ1 = 0;
        estadoJogo.pontosJ2 = 0;
        estadoJogo.jogadorAtual = 1;
        estadoJogo.discoMaior = { x: 400, y: 50 };
        estadoJogo.discoMenor = { x: 400, y: 225 };

        io.emit('jogoReiniciado', estadoJogo);
    });

    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        jogadoresConectados = jogadoresConectados.filter(j => j.id !== socket.id);
        io.emit('jogadorDesconectou');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Bilhar rodando na porta ${PORT}`);
});