// Configuração de Comunicação Socket.io
const socket = io();

// Estado do Jogo
let meuNumeroJogador = null;
let jogadorAtual = 1;
let modoTreino = false;
let mesaBloqueada = false;

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

// Função de Reinício chamada pelo HTML
function reiniciarPartida() {
    if (socket) socket.emit('reiniciarPartida');
}

// Oculta overlays de carregamento
function ocultarAvisos() {
    const ids = ["telaEspera", "statusConexao", "mensagemConexao", "aguardandoServidor"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    document.querySelectorAll('div, p, span').forEach(el => {
        if (el.textContent && el.textContent.includes('Conectando ao servidor')) {
            el.style.display = 'none';
        }
    });
}

socket.on('connect', ocultarAvisos);
socket.on('atribuirJogador', (num) => { meuNumeroJogador = num; });
socket.on('atualizarEstado', (estado) => {
    ocultarAvisos();
    jogadorAtual = estado.jogadorAtual;
    if (estado.modoTreino !== undefined) {
        modoTreino = estado.modoTreino;
        const bannerModo = document.getElementById("bannerModo");
        if (!modoTreino && bannerModo) bannerModo.style.display = "none";
    }
});

// Funções de Auxílio
function obterCoordenadas(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clienteX - rect.left, y: clienteY - rect.top };
}

function confirmarEExecutarTacada() {
    if (miraPronta && (jogadorAtual === meuNumeroJogador || modoTreino) && !emMovimento) {
        const vx = (controleX - discoMaior.x) * FORCA_MULT;
        const vy = (controleY - discoMaior.y) * FORCA_MULT;
        const proximo = (modoTreino || mesaBloqueada) ? jogadorAtual : (jogadorAtual === 1 ? 2 : 1);

        socket.emit('realizarTacada', { vx, vy, proximoJogador: proximo, autor: meuNumeroJogador });
        
        miraPronta = false;
        const btnDisparar = document.getElementById("btnDisparar");
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

// Renderização Direta no Canvas
function desenhar() {
    const canvas = document.getElementById("canvasMesa");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const corBordaJ1 = (jogadorAtual === 2) ? '#ffeb3b' : '#3d2314';
    const larguraBordaJ1 = (jogadorAtual === 2) ? 6 : 4;

    const corBordaJ2 = (jogadorAtual === 1) ? '#ffeb3b' : '#3d2314';
    const larguraBordaJ2 = (jogadorAtual === 1) ? 6 : 4;

    // Caçapa J2 (Esquerda)
    ctx.beginPath(); ctx.arc(buracoJ1.x, buracoJ1.y, buracoJ1.raio, 0, Math.PI * 2);
    ctx.fillStyle = '#140c07'; ctx.fill(); 
    ctx.strokeStyle = corBordaJ1; ctx.lineWidth = larguraBordaJ1; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('2', buracoJ1.x, buracoJ1.y);

    // Caçapa J1 (Direita)
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

    // Discos
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

// Inicialização dos Eventos
window.addEventListener("load", () => {
    ocultarAvisos();
    const canvas = document.getElementById("canvasMesa");
    const btnDisparar = document.getElementById("btnDisparar");
    const sliderForca = document.getElementById("sliderForca");

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
        });
    }

    if (btnDisparar) {
        btnDisparar.addEventListener('click', confirmarEExecutarTacada);
    }

    if (canvas) {
        const iniciarArrasto = (e) => {
            if (emMovimento || (jogadorAtual !== meuNumeroJogador && !modoTreino)) return;
            const coords = obterCoordenadas(canvas, e);
            const parado = Math.abs(discoMaior.vx) < 0.05 && Math.abs(discoMaior.vy) < 0.05 &&
                           Math.abs(discoMenor.vx) < 0.05 && Math.abs(discoMenor.vy) < 0.05;
            const dist = Math.hypot(coords.x - discoMaior.x, coords.y - discoMaior.y);
            if ((dist < discoMaior.raio || miraPronta) && parado && !discoMenor.caindo && !discoMaior.caindo && discoMaior.visivel) {
                arrastando = true;
                controleX = coords.x;
                controleY = coords.y;
                e.preventDefault();
            }
        };

        const moverArrasto = (e) => {
            if (arrastando) {
                const coords = obterCoordenadas(canvas, e);
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
        };

        const finalizarArrasto = () => { arrastando = false; };

        canvas.addEventListener('mousedown', iniciarArrasto);
        canvas.addEventListener('mousemove', moverArrasto);
        canvas.addEventListener('mouseup', finalizarArrasto);

        canvas.addEventListener('touchstart', iniciarArrasto, { passive: false });
        canvas.addEventListener('touchmove', moverArrasto, { passive: false });
        canvas.addEventListener('touchend', finalizarArrasto);
    }

    loop();
});