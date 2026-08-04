// Configuração de Comunicação Socket.io
const socket = io();

// Estado do Jogo
let meuNumeroJogador = null;
let jogadorAtual = 1;
let modoTreino = false;
let mesaBloqueada = false;

// Elementos de UI e Canvas
let canvas = document.getElementById("canvasMesa");
let ctx = canvas ? canvas.getContext("2d") : null;
let btnDisparar = document.getElementById("btnDisparar");
let sliderForca = document.getElementById("sliderForca");
let painelForca = document.getElementById("painel-forca");
let bannerModo = document.getElementById("bannerModo");

// Física e Posições
const FORCA_MULT = 0.15;
let forcaAtual = 80;
let miraPronta = false;
let arrastando = false;
let emMovimento = false;

let controleX = 0;
let controleY = 0;

// Objetos do Jogo
let discoMaior = { x: 200, y: 200, vx: 0, vy: 0, raio: 20, cor: '#ffffff', visivel: true, caindo: false, escala: 1 };
let discoMenor = { x: 500, y: 200, vx: 0, vy: 0, raio: 14, cor: '#e74c3c', visivel: true, caindo: false, escala: 1 };

let buracoJ1 = { x: 60, y: 200, raio: 30 };  // Alvo do Jogador 2
let buracoJ2 = { x: 740, y: 200, raio: 30 }; // Alvo do Jogador 1

// Função global para o botão de reiniciar do HTML
function reiniciarPartida() {
    if (socket) {
        socket.emit('reiniciarPartida');
    }
}

// Oculta avisos de carregamento ao conectar
function esconderCarregamento() {
    const ids = ["telaEspera", "statusConexao", "mensagemConexao", "aguardandoServidor"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

socket.on('connect', esconderCarregamento);

socket.on('atribuirJogador', (num) => {
    meuNumeroJogador = num;
});

socket.on('atualizarEstado', (estado) => {
    esconderCarregamento();
    jogadorAtual = estado.jogadorAtual;
    if (estado.modoTreino !== undefined) {
        modoTreino = estado.modoTreino;
        if (!modoTreino && bannerModo) {
            bannerModo.style.display = "none";
        }
    }
});

// Funções de Coordenadas
function obterCoordenadas(e) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clienteX - rect.left,
        y: clienteY - rect.top
    };
}

// Manipulação do Arrasto / Mira
function iniciarArrasto(e) {
    if (emMovimento || (jogadorAtual !== meuNumeroJogador && !modoTreino)) return;

    const coords = obterCoordenadas(e);
    const parado = Math.abs(discoMaior.vx) < 0.05 && Math.abs(discoMaior.vy) < 0.05 &&
                   Math.abs(discoMenor.vx) < 0.05 && Math.abs(discoMenor.vy) < 0.05;

    const dist = Math.hypot(coords.x - discoMaior.x, coords.y - discoMaior.y);
    if ((dist < discoMaior.raio || miraPronta) && parado && !discoMenor.caindo && !discoMaior.caindo && discoMaior.visivel) {
        arrastando = true;
        controleX = coords.x;
        controleY = coords.y;
        e.preventDefault();
    }
}

function moverArrasto(e) {
    if (arrastando) {
        const coords = obterCoordenadas(e);
        controleX = coords.x;
        controleY = coords.y;
        miraPronta = true;

        if (btnDisparar) btnDisparar.style.display = "inline-block";
        
        let dx = controleX - discoMaior.x;
        let dy = controleY - discoMaior.y;
        forcaAtual = Math.hypot(dx, dy);
        if (sliderForca) sliderForca.value = forcaAtual;

        e.preventDefault();
    }
}

function finalizarArrasto(e) {
    if (arrastando) {
        arrastando = false;
    }
}

function confirmarEExecutarTacada() {
    if (miraPronta && (jogadorAtual === meuNumeroJogador || modoTreino) && !emMovimento) {
        const vx = (controleX - discoMaior.x) * FORCA_MULT;
        const vy = (controleY - discoMaior.y) * FORCA_MULT;
        
        const proximo = (modoTreino || mesaBloqueada) ? jogadorAtual : (jogadorAtual === 1 ? 2 : 1);

        socket.emit('realizarTacada', { vx, vy, proximoJogador: proximo, autor: meuNumeroJogador });
        
        miraPronta = false;
        if (btnDisparar) btnDisparar.style.display = "none";
    }
}

function atualizarFisica() {
    if (discoMaior.visivel) {
        discoMaior.x += discoMaior.vx;
        discoMaior.y += discoMaior.vy;
        discoMaior.vx *= 0.98;
        discoMaior.vy *= 0.98;
    }

    if (discoMenor.visivel) {
        discoMenor.x += discoMenor.vx;
        discoMenor.y += discoMenor.vy;
        discoMenor.vx *= 0.98;
        discoMenor.vy *= 0.98;
    }

    emMovimento = Math.hypot(discoMaior.vx, discoMaior.vy) > 0.05 || Math.hypot(discoMenor.vx, discoMenor.vy) > 0.05;
}

function desenhar() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const corBordaJ1 = (jogadorAtual === 2) ? '#ffeb3b' : '#3d2314';
    const larguraBordaJ1 = (jogadorAtual === 2) ? 6 : 4;

    const corBordaJ2 = (jogadorAtual === 1) ? '#ffeb3b' : '#3d2314';
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

    // Linha de Mira
    if (miraPronta && discoMaior.visivel && !discoMaior.caindo) {
        const dx = controleX - discoMaior.x;
        const dy = controleY - discoMaior.y;
        const angulo = Math.atan2(dy, dx);

        const comprimentoMira = 600;
        const miraFimX = discoMaior.x + Math.cos(angulo) * comprimentoMira;
        const miraFimY = discoMaior.y + Math.sin(angulo) * comprimentoMira;

        const larguraLinhaMira = 1 + (forcaAtual / 25);

        ctx.beginPath(); 
        ctx.moveTo(discoMaior.x, discoMaior.y); 
        ctx.lineTo(miraFimX, miraFimY);
        ctx.strokeStyle = '#00ffff'; 
        ctx.lineWidth = larguraLinhaMira; 
        ctx.setLineDash([]); 
        ctx.stroke();
        
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

// Configuração dos Eventos e Inicialização Imediata
function inicializar() {
    canvas = document.getElementById("canvasMesa");
    if (canvas) ctx = canvas.getContext("2d");

    btnDisparar = document.getElementById("btnDisparar");
    sliderForca = document.getElementById("sliderForca");
    painelForca = document.getElementById("painel-forca");
    bannerModo = document.getElementById("bannerModo");

    if (sliderForca) {
        sliderForca.value = forcaAtual;
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

    if (btnDisparar) {
        btnDisparar.addEventListener('click', confirmarEExecutarTacada);
    }

    if (canvas) {
        canvas.addEventListener('mousedown', iniciarArrasto);
        canvas.addEventListener('mousemove', moverArrasto);
        canvas.addEventListener('mouseup', finalizarArrasto);

        canvas.addEventListener('touchstart', iniciarArrasto, { passive: false });
        canvas.addEventListener('touchmove', moverArrasto, { passive: false });
        canvas.addEventListener('touchend', finalizarArrasto);
    }

    // Inicia o desenho imediatamente
    loop();
}

// Executa a inicialização assim que o script é lido
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    inicializar();
}