const socket = io();
const canvas = document.getElementById("mesa");
const ctx = canvas.getContext("2d");
const elementoMensagem = document.getElementById("mensagem");
const elementoTurno = document.getElementById("turno-indicador");
const btnDisparar = document.getElementById("btn-disparar");

const ATRITO = 0.985;
const FORCA_MULT = 0.12;

let meuNumeroJogador = 0;
let jogadorAtual = 1;
let autorUltimaTacada = 1; 
let pontosJ1 = 0, pontosJ2 = 0;
let emMovimento = false;
let dadosSincronizadosEnviados = false;
let resetPendente = false;

const buracoJ1 = { x: 60, y: 225, raio: 32 }; 
const buracoJ2 = { x: 740, y: 225, raio: 32 }; 

const discoMaior = { x: 400, y: 50, raio: 24, massa: 2.0, vx: 0, vy: 0, cor: '#1e88e5', visivel: true, caindo: false, escala: 1.0 };
const discoMenor = { x: 400, y: 225, raio: 15, massa: 1.0, vx: 0, vy: 0, cor: '#e53935', visivel: true, caindo: false, escala: 1.0 };

let arrastando = false;
let miraPronta = false;
let controleX = 0, controleY = 0;

// --- SOCKETS ---
socket.on('atribuirJogador', (data) => {
    meuNumeroJogador = data.numeroJogador;
    if (meuNumeroJogador === 0) {
        elementoMensagem.innerHTML = "A mesa está cheia! Você é um espectador.";
    } else {
        elementoMensagem.innerHTML = `Você é o JOGADOR ${meuNumeroJogador}.<br>Aguardando o adversário...`;
    }
});

socket.on('jogoPronto', () => {
    elementoMensagem.style.display = "none";
    atualizarIndicadorTurno();
});

socket.on('executarTacada', (dados) => {
    discoMaior.vx = dados.vx;
    discoMaior.vy = dados.vy;
    autorUltimaTacada = dados.autor; 
    jogadorAtual = dados.proximoJogador;
    
    // Altera a cor do disco maior para combinar com o jogador da vez
    discoMaior.cor = (jogadorAtual === 1) ? '#1e88e5' : '#ff8a65';
    emMovimento = true;
    miraPronta = false;
    btnDisparar.style.display = "none";
    dadosSincronizadosEnviados = false;
    atualizarIndicadorTurno();
});

socket.on('sincronizarPosicoes', (dados) => {
    discoMaior.x = dados.maior.x;
    discoMaior.y = dados.maior.y;
    discoMaior.vx = 0;
    discoMaior.vy = 0;
    discoMaior.visivel = dados.maior.visivel;
    if (dados.maior.caindo !== undefined) discoMaior.caindo = dados.maior.caindo;
    if (dados.maior.escala !== undefined) discoMaior.escala = dados.maior.escala;

    discoMenor.x = dados.menor.x;
    discoMenor.y = dados.menor.y;
    discoMenor.vx = 0;
    discoMenor.vy = 0;
    discoMenor.visivel = dados.menor.visivel;
    if (dados.menor.caindo !== undefined) discoMenor.caindo = dados.menor.caindo;
    if (dados.menor.escala !== undefined) discoMenor.escala = dados.menor.escala;
});

socket.on('atualizarPlacar', (estado) => {
    pontosJ1 = estado.pontosJ1;
    pontosJ2 = estado.pontosJ2;
    document.getElementById("ptsJ1").innerText = pontosJ1;
    document.getElementById("ptsJ2").innerText = pontosJ2;
});

socket.on('jogoReiniciado', (estado) => {
    pontosJ1 = estado.pontosJ1;
    pontosJ2 = estado.pontosJ2;
    jogadorAtual = estado.jogadorAtual;
    miraPronta = false;
    btnDisparar.style.display = "none";
    resetPendente = false;

    document.getElementById("ptsJ1").innerText = 0;
    document.getElementById("ptsJ2").innerText = 0;

    discoMaior.x = 400; discoMaior.y = 50; discoMaior.vx = 0; discoMaior.vy = 0;
    discoMaior.visivel = true; discoMaior.caindo = false; discoMaior.escala = 1.0;

    discoMenor.x = 400; discoMenor.y = 225; discoMenor.vx = 0; discoMenor.vy = 0;
    discoMenor.visivel = true; discoMenor.caindo = false; discoMenor.escala = 1.0;

    elementoMensagem.style.display = "none";
    atualizarIndicadorTurno();
});

function reiniciarPartida() {
    socket.emit('solicitarReinicio');
}

function atualizarIndicadorTurno() {
    if (jogadorAtual === meuNumeroJogador) {
        elementoTurno.innerText = "SUA VEZ DE JOGAR!";
        elementoTurno.style.color = "#00ff88";
    } else {
        elementoTurno.innerText = `Aguardando jogada do Jogador ${jogadorAtual}...`;
        elementoTurno.style.color = "#ffeb3b";
        btnDisparar.style.display = "none";
    }
}

// Nova inteligência de reposicionamento baseada nas regras de bilhar
function tratarReposicionamento() {
    if (!discoMenor.visivel) {
        // A vermelha caiu: repõe a vermelha em nova posição e a azul na base
        const desvioY = (Math.random() - 0.5) * 160;
        discoMenor.x = 400; discoMenor.y = 225 + desvioY;
        discoMenor.visivel = true; discoMenor.caindo = false; discoMenor.escala = 1.0;
        
        discoMaior.x = 400; discoMaior.y = 50;
        discoMaior.visivel = true; discoMaior.caindo = false; discoMaior.escala = 1.0;
    } 
    else if (!discoMaior.visivel) {
        // Apenas a azul caiu (Falta): repõe apenas a azul, a vermelha fica intocável
        discoMaior.x = 400; discoMaior.y = 50;
        discoMaior.visivel = true; discoMaior.caindo = false; discoMaior.escala = 1.0;
    }

    discoMaior.vx = 0; discoMaior.vy = 0;
    discoMenor.vx = 0; discoMenor.vy = 0;

    if (meuNumeroJogador === 1) {
        socket.emit('notificarSincronizacao', {
            maior: { x: discoMaior.x, y: discoMaior.y, visivel: discoMaior.visivel, caindo: discoMaior.caindo, escala: discoMaior.escala },
            menor: { x: discoMenor.x, y: discoMenor.y, visivel: discoMenor.visivel, caindo: discoMenor.caindo, escala: discoMenor.escala }
        });
    }
}

function obterCoordenadas(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let cX = e.clientX, cY = e.clientY;
    if (e.touches && e.touches.length > 0) {
        cX = e.touches[0].clientX; cY = e.touches[0].clientY;
    }
    return { x: (cX - rect.left) * scaleX, y: (cY - rect.top) * scaleY };
}

function iniciarArrasto(e) {
    if (jogadorAtual !== meuNumeroJogador) return;

    const coords = obterCoordenadas(e);
    const parado = Math.abs(discoMaior.vx) < 0.05 && Math.abs(discoMaior.vy) < 0.05 &&
                   Math.abs(discoMenor.vx) < 0.05 && Math.abs(discoMenor.vy) < 0.05;

    const dist = Math.hypot(coords.x - discoMaior.x, coords.y - discoMaior.y);
    if ((dist < discoMaior.raio || miraPronta) && parado && !discoMenor.caindo && !discoMaior.caindo && discoMaior.visivel) {
        arrastando = true;
        controleX = coords.x; controleY = coords.y;
        e.preventDefault();
    }
}

function moverArrasto(e) {
    if (arrastando) {
        const coords = obterCoordenadas(e);
        controleX = coords.x; controleY = coords.y;
        miraPronta = true;
        btnDisparar.style.display = "inline-block";
        e.preventDefault();
    }
}

function finalizarArrasto(e) {
    if (arrastando) {
        arrastando = false; 
    }
}

function confirmarEExecutarTacada() {
    if (miraPronta && jogadorAtual === meuNumeroJogador) {
        const vx = (controleX - discoMaior.x) * FORCA_MULT;
        const vy = (controleY - discoMaior.y) * FORCA_MULT;
        const proximo = jogadorAtual === 1 ? 2 : 1;

        socket.emit('realizarTacada', { vx, vy, proximoJogador: proximo, autor: meuNumeroJogador });
    }
}

canvas.addEventListener('mousedown', iniciarArrasto);
canvas.addEventListener('mousemove', moverArrasto);
canvas.addEventListener('mouseup', finalizarArrasto);
canvas.addEventListener('touchstart', iniciarArrasto, { passive: false });
canvas.addEventListener('touchmove', moverArrasto, { passive: false });
canvas.addEventListener('touchend', finalizarArrasto);

function atualizarFisica() {
    const discos = [];
    if (discoMaior.visivel) discos.push(discoMaior);
    if (discoMenor.visivel) discos.push(discoMenor);

    discos.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        d.vx *= ATRITO; d.vy *= ATRITO;
        if (Math.abs(d.vx) < 0.01) d.vx = 0;
        if (Math.abs(d.vy) < 0.01) d.vy = 0;

        if (d.x - d.raio < 0) { d.x = d.raio; d.vx *= -1; }
        if (d.x + d.raio > canvas.width) { d.x = canvas.width - d.raio; d.vx *= -1; }
        if (d.y - d.raio < 0) { d.y = d.raio; d.vy *= -1; }
        if (d.y + d.raio > canvas.height) { d.y = canvas.height - d.raio; d.vy *= -1; }
    });

    if (discoMenor.visivel && !discoMenor.caindo && discoMaior.visivel && !discoMaior.caindo) {
        const dx = discoMenor.x - discoMaior.x;
        const dy = discoMenor.y - discoMaior.y;
        const distancia = Math.hypot(dx, dy);
        const raioSoma = discoMaior.raio + discoMenor.raio;

        if (distancia < raioSoma) {
            const sobreposicao = raioSoma - distancia;
            const nx = dx / distancia, ny = dy / distancia;
            discoMaior.x -= nx * sobreposicao * 0.5; discoMaior.y -= ny * sobreposicao * 0.5;
            discoMenor.x += nx * sobreposicao * 0.5; discoMenor.y += ny * sobreposicao * 0.5;

            const kx = discoMaior.vx - discoMenor.vx, ky = discoMaior.vy - discoMenor.vy;
            const p = 2 * (nx * kx + ny * ky) / (discoMaior.massa + discoMenor.massa);

            discoMaior.vx -= p * discoMenor.massa * nx; discoMaior.vy -= p * discoMenor.massa * ny;
            discoMenor.vx += p * discoMenor.massa * nx; discoMenor.vy += p * discoMenor.massa * ny;
        }
    }

    discos.forEach(d => {
        if (!d.caindo) {
            const distJ1 = Math.hypot(d.x - buracoJ1.x, d.y - buracoJ1.y);
            const distJ2 = Math.hypot(d.x - buracoJ2.x, d.y - buracoJ2.y);
            
            if (distJ1 <= buracoJ1.raio || distJ2 <= buracoJ2.raio) {
                if (d === discoMenor) {
                    if (distJ1 <= buracoJ1.raio) {
                        if (meuNumeroJogador === 1) { pontosJ2++; socket.emit('notificarPonto', { pontosJ1, pontosJ2 }); }
                        iniciarAnimacaoQueda(d, "PONTO DO JOGADOR 2!");
                    } else if (distJ2 <= buracoJ2.raio) {
                        if (meuNumeroJogador === 1) { pontosJ1++; socket.emit('notificarPonto', { pontosJ1, pontosJ2 }); }
                        iniciarAnimacaoQueda(d, "PONTO DO JOGADOR 1!");
                    }
                } else if (d === discoMaior) {
                    if (meuNumeroJogador === 1) {
                        if (autorUltimaTacada === 1) pontosJ1--;
                        if (autorUltimaTacada === 2) pontosJ2--;
                        socket.emit('notificarPonto', { pontosJ1, pontosJ2 });
                    }
                    iniciarAnimacaoQueda(d, `FALTA! JOGADOR ${autorUltimaTacada} PERDEU 1 PONTO!`);
                }
            }
        }
    });

    const tudoParado = discoMaior.vx === 0 && discoMaior.vy === 0 && discoMenor.vx === 0 && discoMenor.vy === 0;
    if (emMovimento && tudoParado && !dadosSincronizadosEnviados) {
        emMovimento = false;
        dadosSincronizadosEnviados = true;

        if (meuNumeroJogador === 1) {
            socket.emit('notificarSincronizacao', {
                maior: { x: discoMaior.x, y: discoMaior.y, visivel: discoMaior.visivel, caindo: discoMaior.caindo, escala: discoMaior.escala },
                menor: { x: discoMenor.x, y: discoMenor.y, visivel: discoMenor.visivel, caindo: discoMenor.caindo, escala: discoMenor.escala }
            });
        }
    }

    discos.forEach(d => {
        if (d.caindo) {
            d.escala -= 0.08;
            if (d.escala <= 0) {
                d.escala = 0; d.visivel = false; d.caindo = false;
                
                if (!resetPendente) {
                    resetPendente = true;
                    setTimeout(() => {
                        elementoMensagem.style.display = "none";
                        tratarReposicionamento();
                        resetPendente = false;
                    }, 2000); 
                }
            }
        }
    });
}

function iniciarAnimacaoQueda(disco, texto) {
    disco.caindo = true; disco.vx = 0; disco.vy = 0;
    elementoMensagem.innerHTML = texto;
    elementoMensagem.style.display = "block";
}

function desenhar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Configuração comum para os números nos buracos
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Buraco J2 (Esquerda) com o número 2 no centro
    ctx.beginPath(); ctx.arc(buracoJ1.x, buracoJ1.y, buracoJ1.raio, 0, Math.PI * 2);
    ctx.fillStyle = '#140c07'; ctx.fill(); ctx.strokeStyle = '#3d2314'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('2', buracoJ1.x, buracoJ1.y);

    // Buraco J1 (Direita) com o número 1 no centro
    ctx.beginPath(); ctx.arc(buracoJ2.x, buracoJ2.y, buracoJ2.raio, 0, Math.PI * 2);
    ctx.fillStyle = '#140c07'; ctx.fill(); ctx.strokeStyle = '#3d2314'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('1', buracoJ2.x, buracoJ2.y);

    // Elástico / Mira com Cursor em Cruz (Linha longa, fina e contínua)
    if (miraPronta && discoMaior.visivel && !discoMaior.caindo) {
        // Calculamos a direção (ângulo) entre o disco e o ponto de controle
        const dx = controleX - discoMaior.x;
        const dy = controleY - discoMaior.y;
        const angulo = Math.atan2(dy, dx);

        // Define um comprimento longo para a linha de mira (ex: 600 pixels)
        const comprimentoMira = 600;
        const miraFimX = discoMaior.x + Math.cos(angulo) * comprimentoMira;
        const miraFimY = discoMaior.y + Math.sin(angulo) * comprimentoMira;

        // Linha contínua, longa e fina (lineWidth: 1.5)
        ctx.beginPath(); 
        ctx.moveTo(discoMaior.x, discoMaior.y); 
        ctx.lineTo(miraFimX, miraFimY);
        ctx.strokeStyle = '#00ffff'; 
        ctx.lineWidth = 1.5; 
        ctx.setLineDash([]); // Garante que a linha é contínua
        ctx.stroke();
        
        // Cursor em cruz (permanece no ponto exato do toque/controle de força)
        const tamCruz = 12;
        ctx.beginPath();
        ctx.moveTo(controleX - tamCruz, controleY); ctx.lineTo(controleX + tamCruz, controleY);
        ctx.moveTo(controleX, controleY - tamCruz); ctx.lineTo(controleX, controleY + tamCruz);
        ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2; ctx.stroke();

        ctx.beginPath(); ctx.arc(controleX, controleY, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    }

    if (discoMaior.visivel) {
        ctx.beginPath(); const r = discoMaior.raio * discoMaior.escala;
        ctx.arc(discoMaior.x, discoMaior.y, Math.max(0, r), 0, Math.PI * 2);
        ctx.fillStyle = discoMaior.cor; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * discoMaior.escala; ctx.stroke();
    }

    if (discoMenor.visivel) {
        ctx.beginPath(); const r = discoMenor.raio * discoMenor.escala;
        ctx.arc(discoMenor.x, discoMenor.y, Math.max(0, r), 0, Math.PI * 2);
        ctx.fillStyle = discoMenor.cor; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * discoMenor.escala; ctx.stroke();
    }
}

function loop() {
    atualizarFisica();
    desenhar();
    requestAnimationFrame(loop);
}

loop();