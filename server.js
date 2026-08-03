const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve o arquivo index.html localizado na própria raiz do projeto
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

    // Atribuição de Jogadores (Máximo 2)
    if (jogadoresConectados.length < 2) {
        const numeroJogador = jogadoresConectados.length + 1;
        jogadoresConectados.push({ id: socket.id, numero: numeroJogador });
        
        socket.emit('atribuirJogador', { numeroJogador });
        console.log(`Jogador ${numeroJogador} atribuído para ${socket.id}`);
    } else {
        socket.emit('atribuirJogador', { numeroJogador: 0 }); // Espectador
    }

    // Notifica quando ambos estão conectados na sala
    if (jogadoresConectados.length === 2) {
        io.emit('jogoPronto', { estadoJogo });
    }

    // Recebe o disparo do jogador da vez e repassa para o adversário
    socket.on('realizarTacada', (dadosTacada) => {
        io.emit('executarTacada', dadosTacada);
    });

    // Atualização do placar
    socket.on('notificarPonto', (dadosPonto) => {
        estadoJogo.pontosJ1 = dadosPonto.pontosJ1;
        estadoJogo.pontosJ2 = dadosPonto.pontosJ2;
        io.emit('atualizarPlacar', estadoJogo);
    });

    // Recebe as posições exatas enviadas pelo J1 e repassa para o J2
    socket.on('notificarSincronizacao', (dadosPosicao) => {
        socket.broadcast.emit('sincronizarPosicoes', dadosPosicao);
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