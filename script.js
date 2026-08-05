const socket = io();
const canvas = document.getElementById("mesa");
const ctx = canvas.getContext("2d");
const elementoMensagem = document.getElementById("mensagem");
const elementoTurno = document.getElementById("turno-indicador");
const btnDisparar = document.getElementById("btn-disparar");
const sliderForca = document.getElementById("sliderForca");
const painelForca = document.getElementById("painel-forca");

const ATRITO = 0.985;
const FORCA_MULT = 0.12;

let meuNumeroJogador = 0;
let jogadorAtual = 1;
let autorUltimaTacada = 1; 
let pontosJ1 = 0, pontosJ2 = 0;
let emMovimento = false;
let dadosSincronizadosEnviados = false;
let resetPendente = false;
let forcaAtual = 80; // Valor padrão de força
let avisoTreinoOcultado = false;

let modoTreino = true;
let mesaBloqueada = false;
const btnTrava = document.getElementById("btn-trava");

const buracoJ1 = { x: 60, y: 225, raio: 32 }; 
const buracoJ2 = { x: 740, y: 225, raio: 32 }; 

const discoMaior = { x: 400, y: 50, raio: 24, massa: 2.0, vx: 0, vy: 0, cor: '#1e88e5', visivel: true, caindo: false, escala: 1.0 };
const discoMenor = { x: 400, y: 225, raio: 15, massa: 1.0, vx: 0, vy: 0, cor: '#e53935', visivel: true, caindo: false, escala: 1.0 };

let arrastando = false;
let miraPronta = false;
let controleX = 0, controleY = 0;

// --- FUNÇÃO AUXILIAR DE INDICADOR DE TURNO ---

function atualizarIndicadorTurno() {
    const turnoIndicador = document.getElementById('turno-indicador');
    if (!turnoIndicador) return;

    if (meuNumeroJogador === 0) {
        turnoIndicador.innerText = "ESPECTADOR";
        turnoIndicador.style.color = "#ffffff";
        return;
    }

    if (jogadorAtual === meuNumeroJogador) {
        turnoIndicador.innerText = `J${meuNumeroJogador}: SUA VEZ`;
        turnoIndicador.style.color = "#00FF00";
    } else {
        turnoIndicador.innerText = `J${meuNumeroJogador}: AGUARDE`;
        turnoIndicador.style.color = "#FFCC00";
    }
}

// --- SOCKETS ---
socket.on('atribuirJogador', (data) => {
    // Converte o texto recebido do servidor para um número inteiro
    meuNumeroJogador = Number(data.numeroJogador);
    mesaBloqueada = data.mesaBloqueada;
    
    // Atualiza o identificador fixo do jogador
    const elIdentificador = document.getElementById('identificador-jogador');
    if (elIdentificador) {
        if (meuNumeroJogador === 1) {
            elIdentificador.innerText = "VOCÊ: JOGADOR 1 (Azul)";
            elIdentificador.style.color = "#1e88e5";
        } else if (meuNumeroJogador === 2) {
            elIdentificador.innerText = "VOCÊ: JOGADOR 2 (Laranja)";
            elIdentificador.style.color = "#ff8a65";
        } else {
            elIdentificador.innerText = "VOCÊ: ESPECTADOR";
            elIdentificador.style.color = "#ffffff";
        }
    }

    if (meuNumeroJogador !== 1 && typeof btnTrava !== 'undefined' && btnTrava) {
        btnTrava.style.display = "none";
    }
    atualizarIndicadorTurno();
});

let jogoProntoFlag = false;

socket.on('jogoPronto', () => {
    jogoProntoFlag = true;
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
    if (btnDisparar) btnDisparar.style.display = 'inline-block';
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
    const ptsJ1El = document.getElementById("ptsJ1");
    const ptsJ2El = document.getElementById("ptsJ2");
    if (ptsJ1El) ptsJ1El.innerText = pontosJ1;
    if (ptsJ2El) ptsJ2El.innerText = pontosJ2;
});

socket.on('jogoReiniciado', (estado) => {
    pontosJ1 = estado.pontosJ1;
    pontosJ2 = estado.pontosJ2;
    jogadorAtual = estado.jogadorAtual;
    miraPronta = false;
    if (btnDisparar) btnDisparar.style.display = 'inline-block';
    resetPendente = false;
    atualizarIndicadorTurno();
});

socket.on('statusTravaAtualizado', (dados) => {
    mesaBloqueada = dados.mesaBloqueada;
    if (btnTrava) {
        btnTrava.innerText = mesaBloqueada ? "Modo: Treino Fechado 🔒" : "Modo: Aberto a Desafiantes 🔓";
        btnTrava.style.background = mesaBloqueada ? "#e53935" : "#2e7d32";
    }
});

socket.on('turnoAtualizado', (estado) => {
    // O Number() garante que, mesmo se o servidor enviar texto ("2"), 
    // ele seja convertido para o número inteiro 2, validando a troca de cor!
    jogadorAtual = Number(estado.jogadorAtual) || Number(estado.proximoJogador) || 1;
    
    atualizarIndicadorTurno();
});
function alternarTravaTreino() {
    if (meuNumeroJogador !== 1) return; // Apenas J1 pode travar
    mesaBloqueada = !mesaBloqueada;
    socket.emit('alternarTravaMesa', mesaBloqueada);
}

socket.on('statusTravaAtualizado', (dados) => {
    const btnTrava = document.getElementById('btn-trava');
    mesaBloqueada = dados.mesaBloqueada;
    if (btnTrava) {
        btnTrava.innerText = mesaBloqueada ? "Modo: Privado (Treino)" : "Modo: Aberto a Desafiantes";
    }
});

document.getElementById("ptsJ1").innerText = 0;
    document.getElementById("ptsJ2").innerText = 0;

    // Disco Maior (Tacada) posicionado na borda inferior (y = 400)
    discoMaior.x = 400; 
    discoMaior.y = 400; 
    discoMaior.vx = 0; 
    discoMaior.vy = 0;
    discoMaior.visivel = true; 
    discoMaior.caindo = false; 
    discoMaior.escala = 1.0;

    // Disco Menor no centro da mesa (y = 225)
    discoMenor.x = 400; 
    discoMenor.y = 225; 
    discoMenor.vx = 0; 
    discoMenor.vy = 0;
    discoMenor.visivel = true; 
    discoMenor.caindo = false; 
    discoMenor.escala = 1.0;

    elementoMensagem.style.display = "none";
    atualizarIndicadorTurno();


function reiniciarPartida() {
    socket.emit('solicitarReinicio');
}

function atualizarIndicadorTurno() {
    const turnoIndicador = document.getElementById('turno-indicador');
    if (!turnoIndicador) return;

    if (meuNumeroJogador === 0) {
        turnoIndicador.innerText = "ESPECTADOR";
        turnoIndicador.style.color = "#ffffff";
        return;
    }

    if (jogadorAtual === meuNumeroJogador) {
        turnoIndicador.innerText = `J${meuNumeroJogador}: SUA VEZ`;
        turnoIndicador.style.color = "#00FF00";
    } else {
        turnoIndicador.innerText = `J${meuNumeroJogador}: AGUARDE`;
        turnoIndicador.style.color = "#FFCC00";
    }
}

// Inteligência de reposicionamento aprimorada para Modo Treino e Partida
function tratarReposicionamento() {
    // Se a vermelha caiu (ponto), repõe a vermelha no centro e a azul na base
    if (!discoMenor.visivel) {
        discoMenor.x = 400; 
        discoMenor.y = 225;
        discoMenor.visivel = true; 
        discoMenor.caindo = false; 
        discoMenor.escala = 1.0;
    }
    
    // Se a azul caiu (falta), repõe apenas a azul
    if (!discoMaior.visivel) {
        discoMaior.x = 400; 
        discoMaior.y = 50;
        discoMaior.visivel = true; 
        discoMaior.caindo = false; 
        discoMaior.escala = 1.0;
    }

    discoMaior.vx = 0; discoMaior.vy = 0;
    discoMenor.vx = 0; discoMenor.vy = 0;

    // Se estiver em jogo normal com 2 jogadores, sincroniza com o servidor
    if (meuNumeroJogador === 1 && !modoTreino && !mesaBloqueada) {
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
    // Impede a jogada na sala aberta se o Jogador 2 ainda não entrou
    if (!modoTreino && !jogoProntoFlag) return;

    if (jogadorAtual !== meuNumeroJogador) return;

    const coords = obterCoordenadas(e);
    // Limite de parada ajustado de 0.05 para 0.20 para evitar o arrasto lento
    const parado = Math.abs(discoMaior.vx) < 0.20 && Math.abs(discoMaior.vy) < 0.20 &&
                   Math.abs(discoMenor.vx) < 0.20 && Math.abs(discoMenor.vy) < 0.20;

    if (parado) {
        // Zera as velocidades imediatamente para travar os discos no lugar
        discoMaior.vx = 0;
        discoMaior.vy = 0;
        discoMenor.vx = 0;
        discoMenor.vy = 0;
    }
    const dist = Math.hypot(coords.x - discoMaior.x, coords.y - discoMaior.y);
    if ((dist < discoMaior.raio || miraPronta) && parado && !discoMenor.caindo && !discoMaior.caindo && discoMaior.visivel) {
        arrastando = true;
        controleX = coords.x; controleY = coords.y;
        
        // Exibe o painel do slider de força ao tocar
        if (painelForca) painelForca.style.display = "block";

        e.preventDefault();
    }
}

function moverArrasto(e) {
    if (arrastando) {
        const coords = obterCoordenadas(e);
        controleX = coords.x; controleY = coords.y;
        miraPronta = true;
        btnDisparar.style.display = "inline-block";

        // Exibe o painel do slider de força enquanto ajusta
        if (painelForca) painelForca.style.display = "block";

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
        // Obtém o valor numérico atual definido no slider
        const elementoSlider = document.getElementById('sliderForca');
        const valorSlider = elementoSlider ? parseFloat(elementoSlider.value) : 100;
        
        // Define o limite máximo que o slider pode atingir (padrão 100 se não estiver definido no HTML)
        const maxSlider = elementoSlider && elementoSlider.max ? parseFloat(elementoSlider.max) : 100;
        
        // Calcula a proporção da força (ex: se o slider estiver em 50 de 100, a proporção é 0.5)
        const proporcaoForca = valorSlider / maxSlider;

        // Aplica a proporção do slider sobre a força do vetor de mira
        const vx = (controleX - discoMaior.x) * FORCA_MULT * proporcaoForca;
        const vy = (controleY - discoMaior.y) * FORCA_MULT * proporcaoForca;
        
        const proximo = (modoTreino || mesaBloqueada) ? 1 : (jogadorAtual === 1 ? 2 : 1);

        socket.emit('realizarTacada', { vx, vy, proximoJogador: proximo, autor: meuNumeroJogador });

        // Esconde o painel do slider após disparar
        if (painelForca) {
            painelForca.style.display = "none";
        }
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
                        if (meuNumeroJogador === 1) { 
                            pontosJ2++; 
                            socket.emit('notificarPonto', { pontosJ1, pontosJ2 }); 
                            // Alterna o turno para o Jogador 2 após o ponto
                            socket.emit('notificarTrocaTurno', { proximoJogador: 2 });
                        }
                        iniciarAnimacaoQueda(d, "PONTO DO JOGADOR 2!");
                    } else if (distJ2 <= buracoJ2.raio) {
                        if (meuNumeroJogador === 1) { 
                            pontosJ1++; 
                            socket.emit('notificarPonto', { pontosJ1, pontosJ2 }); 
                            // Alterna o turno para o Jogador 2 após o ponto
                            socket.emit('notificarTrocaTurno', { proximoJogador: 2 });
                        }
                        iniciarAnimacaoQueda(d, "PONTO DO JOGADOR 1!");
                    }
                } else if (d === discoMaior) {
                    if (meuNumeroJogador === 1) {
                        if (autorUltimaTacada === 1) pontosJ1--;
                        if (autorUltimaTacada === 2) pontosJ2--;
                        socket.emit('notificarPonto', { pontosJ1, pontosJ2 });
                        // Em caso de falta, passa a vez para o adversário de quem cometeu a falta
                        const proximo = (autorUltimaTacada === 1) ? 2 : 1;
                        socket.emit('notificarTrocaTurno', { proximoJogador: proximo });
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

    // Se for modo treino, mantém a vez com você e reseta para a próxima jogada
    if (modoTreino) {
        jogadorAtual = meuNumeroJogador;
    } else {
        // No modo online multiplayer, altera o turno normalmente
        if (jogadorAtual === meuNumeroJogador) {
            const proximo = jogadorAtual === 1 ? 2 : 1;
            socket.emit('notificarTrocaTurno', { proximoJogador: proximo });
        }

        if (meuNumeroJogador === 1) {
            socket.emit('notificarSincronizacao', {
                maior: { x: discoMaior.x, y: discoMaior.y, visivel: discoMaior.visivel, caindo: discoMaior.caindo, escala: discoMaior.escala },
                menor: { x: discoMenor.x, y: discoMenor.y, visivel: discoMenor.visivel, caindo: discoMenor.caindo, escala: discoMenor.escala }
            });
        }
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

    // Define qual caçapa é o alvo do jogador do turno atual
    const corBordaJ1 = (jogadorAtual === 2) ? '#ffeb3b' : '#3d2314'; // Buraco 2 ganha borda amarela se for a vez do J2
    const larguraBordaJ1 = (jogadorAtual === 2) ? 6 : 4;

    const corBordaJ2 = (jogadorAtual === 1) ? '#ffeb3b' : '#3d2314'; // Buraco 1 ganha borda amarela se for a vez do J1
    const larguraBordaJ2 = (jogadorAtual === 1) ? 6 : 4;

    // Buraco J2 (Esquerda) - Alvo do Jogador 2
    ctx.beginPath(); ctx.arc(buracoJ1.x, buracoJ1.y, buracoJ1.raio, 0, Math.PI * 2);
    ctx.fillStyle = '#140c07'; ctx.fill(); 
    ctx.strokeStyle = corBordaJ1; ctx.lineWidth = larguraBordaJ1; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('2', buracoJ1.x, buracoJ1.y);

    // Buraco J1 (Direita) - Alvo do Jogador 1
    ctx.beginPath(); ctx.arc(buracoJ2.x, buracoJ2.y, buracoJ2.raio, 0, Math.PI * 2);
    ctx.fillStyle = '#140c07'; ctx.fill(); 
    ctx.strokeStyle = corBordaJ2; ctx.lineWidth = larguraBordaJ2; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('1', buracoJ2.x, buracoJ2.y);

    // Elástico / Mira com Cursor em Cruz
    if (miraPronta && discoMaior.visivel && !discoMaior.caindo) {
        const dx = controleX - discoMaior.x;
        const dy = controleY - discoMaior.y;
        const angulo = Math.atan2(dy, dx);

        const comprimentoMira = 600;
        const miraFimX = discoMaior.x + Math.cos(angulo) * comprimentoMira;
        const miraFimY = discoMaior.y + Math.sin(angulo) * comprimentoMira;

        // Ajusta a largura da linha de mira proporcionalmente à força escolhida (1.8px até 9px)
        const larguraLinhaMira = 1;  // + (forcaAtual / 25);

        ctx.beginPath(); 
        ctx.moveTo(discoMaior.x, discoMaior.y); 
        ctx.lineTo(miraFimX, miraFimY);
        ctx.strokeStyle = '#00ffff'; 
        ctx.lineWidth = larguraLinhaMira; 
        ctx.setLineDash([]); 
        ctx.stroke();
        
        // Cursor em cruz (permanece no ponto exato do toque/controle de força)
        const tamCruz = 12;
        ctx.beginPath();
        ctx.moveTo(controleX - tamCruz, controleY); ctx.lineTo(controleX + tamCruz, controleY);
        ctx.moveTo(controleX, controleY - tamCruz); ctx.lineTo(controleX, controleY + tamCruz);
        ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2; ctx.stroke();

        ctx.beginPath(); ctx.arc(controleX, controleY, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();

        // Oculta a mensagem de treino assim que a linha da mira aparece na tela pela 1ª vez
        if (modoTreino && !avisoTreinoOcultado) {
            if (typeof elementoMensagem !== 'undefined' && elementoMensagem) {
                elementoMensagem.style.display = 'none';
            }
            avisoTreinoOcultado = true;
        }
    }

    // Desenha o Disco Maior (com alternância de cor: Branco para J1 e Laranja para J2)
    if (discoMaior.visivel) {
        ctx.beginPath(); const r = discoMaior.raio * discoMaior.escala;
        ctx.arc(discoMaior.x, discoMaior.y, Math.max(0, r), 0, Math.PI * 2);
        
        // Se for o Jogador 2, pinta de Laranja (#ff6600), caso contrário usa a cor padrão (Branca)
        ctx.fillStyle = (jogadorAtual === 2) ? '#ff6600' : (discoMaior.cor || '#ffffff'); 
        ctx.fill(); 
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * discoMaior.escala; ctx.stroke();
    }

    // Desenha o Disco Menor
    if (discoMenor.visivel) {
        ctx.beginPath(); const r = discoMenor.raio * discoMenor.escala;
        ctx.arc(discoMenor.x, discoMenor.y, Math.max(0, r), 0, Math.PI * 2);
        ctx.fillStyle = discoMenor.cor; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * discoMenor.escala; ctx.stroke();
    }
}

// Ciclo principal de animação e atualização contínua do Canvas
function loop() {
    atualizarFisica(); // Atualiza posições, velocidades e colisões
    desenhar();        // Redesenha a mesa e as bolas na tela
    requestAnimationFrame(loop);
}

// Inicia o ciclo de animação
loop();

// Controle de Mira e Força via Teclado (+ e - para força, setas para mira, Enter para disparar)
document.addEventListener('keydown', (e) => {
    if (!miraPronta || emMovimento || jogadorAtual !== meuNumeroJogador) return;

    const passoAngulo = 0.03; // Sensibilidade de rotação
    const passoForca = 10;    // Sensibilidade das teclas + e -

    let dx = controleX - discoMaior.x;
    let dy = controleY - discoMaior.y;
    let raioAtual = Math.hypot(dx, dy);
    let anguloAtual = Math.atan2(dy, dx);

    if (e.key === '+' || e.key === '=') {
        raioAtual = Math.min(200, raioAtual + passoForca);
    } else if (e.key === '-' || e.key === '_') {
        raioAtual = Math.max(20, raioAtual - passoForca);
    } else if (e.key === 'ArrowLeft') {
        anguloAtual -= passoAngulo;
    } else if (e.key === 'ArrowRight') {
        anguloAtual += passoAngulo;
    } else if (e.key === 'Enter' || e.key === ' ') {
        confirmarEExecutarTacada();
        if (painelForca) painelForca.style.display = "flex";
        return;
    }

    forcaAtual = raioAtual;
    if (sliderForca) sliderForca.value = forcaAtual;

    controleX = discoMaior.x + Math.cos(anguloAtual) * forcaAtual;
    controleY = discoMaior.y + Math.sin(anguloAtual) * forcaAtual;
    desenhar();
});

// Eventos do Slider de Força (Ideal para Celulares)
// Eventos do Slider de Força (Apenas ajusta a força e a espessura da linha)
  if (sliderForca) {
    sliderForca.addEventListener('input', (e) => {
        if (!miraPronta || emMovimento) return;

        forcaAtual = parseFloat(e.target.value);
        let dx = controleX - discoMaior.x;
        let dy = controleY - discoMaior.y;
        let anguloAtual = Math.atan2(dy, dx);

        controleX = discoMaior.x + Math.cos(anguloAtual) * forcaAtual;
        controleY = discoMaior.y + Math.sin(anguloAtual) * forcaAtual;

        desenhar();
    });
}

// Garante que o painel de força apareça sempre que a mira for ativada no Canvas
canvas.addEventListener('pointerdown', () => {
    if (!emMovimento && jogadorAtual === meuNumeroJogador && painelForca) {
        painelForca.style.display = "block";
    }
});