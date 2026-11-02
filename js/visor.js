
/* ==========================================
   MI GALERIA - VISOR MULTIMEDIA
   Archivo: visor.js
========================================== */

/* ==========================================
   VARIABLES DEL VISOR
========================================== */

let indiceVisor = -1;
let urlVisor = null;

let nivelZoom = 1;
let desplazamientoX = 0;
let desplazamientoY = 0;

let arrastrandoImagen = false;
let inicioArrastreX = 0;
let inicioArrastreY = 0;

let punteroActivo = null;

let controlesZoomOcultos = false;

const ZOOM_MINIMO = 1;
const ZOOM_MAXIMO = 5;
const ZOOM_PASO = 0.25;


/* ==========================================
   ABRIR VISOR
========================================== */

function abrirVisor(id) {

    indiceVisor = archivosVisibles.findIndex(
        archivo => archivo.id === id
    );

    if (indiceVisor === -1) {
        return;
    }

    $("visor").classList.remove("oculto");

    mostrarArchivoVisor();
}


/* ==========================================
   MOSTRAR IMAGEN O VIDEO
========================================== */

function mostrarArchivoVisor() {

    if (
        indiceVisor < 0 ||
        indiceVisor >= archivosVisibles.length
    ) {
        return;
    }

    const contenedor = $("contenidoVisor");

    const videoAnterior = contenedor.querySelector("video");

    if (videoAnterior) {
        videoAnterior.pause();
    }

    terminarArrastre();

    contenedor.innerHTML = "";

    if (urlVisor) {
        URL.revokeObjectURL(urlVisor);
        urlVisor = null;
    }

    const archivo = archivosVisibles[indiceVisor];

    urlVisor = URL.createObjectURL(archivo.datos);

    let multimedia;

    if (archivo.tipo.startsWith("video/")) {

        multimedia = document.createElement("video");

        multimedia.controls = true;
        multimedia.autoplay = true;
        multimedia.playsInline = true;

    } else {

        multimedia = document.createElement("img");

        multimedia.alt = archivo.nombre;
        multimedia.draggable = false;

        multimedia.addEventListener(
            "load",
            aplicarZoom,
            { once: true }
        );
    }

    multimedia.src = urlVisor;

    contenedor.appendChild(multimedia);

    $("nombreVisor").textContent = archivo.nombre;

    restablecerZoom();

    actualizarVisibilidadZoom();
}


/* ==========================================
   CAMBIAR ARCHIVO DEL VISOR
========================================== */

function cambiarVisor(direccion) {

    if (
        archivosVisibles.length === 0 ||
        indiceVisor === -1
    ) {
        return;
    }

    indiceVisor = (
        indiceVisor +
        direccion +
        archivosVisibles.length
    ) % archivosVisibles.length;

    mostrarArchivoVisor();
}


/* ==========================================
   CERRAR VISOR
========================================== */

function cerrarVisor() {

    const visor = $("visor");

    if (document.fullscreenElement === visor) {

        document.exitFullscreen().catch(error => {

            console.error(
                "Error al salir de pantalla completa:",
                error
            );

        });
    }

    const contenedor = $("contenidoVisor");

    const video = contenedor.querySelector("video");

    if (video) {
        video.pause();
    }

    terminarArrastre();

    contenedor.innerHTML = "";

    visor.classList.add("oculto");

    if (urlVisor) {
        URL.revokeObjectURL(urlVisor);
        urlVisor = null;
    }

    indiceVisor = -1;

    nivelZoom = 1;
    desplazamientoX = 0;
    desplazamientoY = 0;

    controlesZoomOcultos = false;

    actualizarVisibilidadZoom();
}


/* ==========================================
   OBTENER IMAGEN ACTUAL
========================================== */

function obtenerImagenVisor() {

    return $("contenidoVisor").querySelector("img");
}


/* ==========================================
   LIMITAR DESPLAZAMIENTO
========================================== */

function limitarDesplazamiento() {

    const imagen = obtenerImagenVisor();
    const area = $("areaZoom");

    if (!imagen || nivelZoom <= 1) {

        desplazamientoX = 0;
        desplazamientoY = 0;

        return;
    }

    const anchoImagen = imagen.offsetWidth * nivelZoom;
    const altoImagen = imagen.offsetHeight * nivelZoom;

    const limiteX = Math.max(
        0,
        (anchoImagen - area.clientWidth) / 2
    );

    const limiteY = Math.max(
        0,
        (altoImagen - area.clientHeight) / 2
    );

    desplazamientoX = Math.max(
        -limiteX,
        Math.min(limiteX, desplazamientoX)
    );

    desplazamientoY = Math.max(
        -limiteY,
        Math.min(limiteY, desplazamientoY)
    );
}


/* ==========================================
   APLICAR ZOOM
========================================== */

function aplicarZoom() {

    const imagen = obtenerImagenVisor();

    $("porcentajeZoom").textContent =
        `${Math.round(nivelZoom * 100)}%`;

    $("zoomMenos").disabled =
        nivelZoom <= ZOOM_MINIMO;

    $("zoomMas").disabled =
        nivelZoom >= ZOOM_MAXIMO;

    if (!imagen) {
        return;
    }

    limitarDesplazamiento();

    imagen.style.transform =
        `translate(${desplazamientoX}px, ${desplazamientoY}px) scale(${nivelZoom})`;

    imagen.classList.toggle(
        "con-zoom",
        nivelZoom > 1
    );

    imagen.classList.toggle(
        "arrastrando",
        arrastrandoImagen
    );
}


/* ==========================================
   CAMBIAR ZOOM
========================================== */

function cambiarZoom(direccion) {

    if (!obtenerImagenVisor()) {
        return;
    }

    nivelZoom = Math.max(
        ZOOM_MINIMO,
        Math.min(
            ZOOM_MAXIMO,
            Math.round(
                (nivelZoom + direccion * ZOOM_PASO) * 100
            ) / 100
        )
    );

    aplicarZoom();
}


/* ==========================================
   RESTABLECER ZOOM
========================================== */

function restablecerZoom() {

    terminarArrastre();

    nivelZoom = 1;
    desplazamientoX = 0;
    desplazamientoY = 0;

    aplicarZoom();
}


/* ==========================================
   INICIAR ARRASTRE
========================================== */

function iniciarArrastre(evento) {

    const imagen = obtenerImagenVisor();

    if (
        !imagen ||
        nivelZoom <= 1 ||
        evento.button !== 0 ||
        evento.target !== imagen
    ) {
        return;
    }

    arrastrandoImagen = true;

    punteroActivo = evento.pointerId;

    inicioArrastreX =
        evento.clientX - desplazamientoX;

    inicioArrastreY =
        evento.clientY - desplazamientoY;

    imagen.setPointerCapture(evento.pointerId);

    aplicarZoom();

    evento.preventDefault();
}


/* ==========================================
   MOVER IMAGEN ARRASTRANDO
========================================== */

function moverArrastre(evento) {

    if (
        !arrastrandoImagen ||
        evento.pointerId !== punteroActivo
    ) {
        return;
    }

    desplazamientoX =
        evento.clientX - inicioArrastreX;

    desplazamientoY =
        evento.clientY - inicioArrastreY;

    aplicarZoom();
}


/* ==========================================
   TERMINAR ARRASTRE
========================================== */

function terminarArrastre() {

    const imagen = obtenerImagenVisor();

    if (
        imagen &&
        punteroActivo !== null &&
        imagen.hasPointerCapture(punteroActivo)
    ) {

        imagen.releasePointerCapture(punteroActivo);
    }

    arrastrandoImagen = false;
    punteroActivo = null;

    if (imagen) {
        imagen.classList.remove("arrastrando");
    }
}


/* ==========================================
   ZOOM CON RUEDA DEL MOUSE
========================================== */

function zoomConRueda(evento) {

    if (!obtenerImagenVisor()) {
        return;
    }

    evento.preventDefault();

    cambiarZoom(
        evento.deltaY < 0 ? 1 : -1
    );
}


/* ==========================================
   OCULTAR CONTROLES DE ZOOM
========================================== */

function ocultarControlesZoom() {

    controlesZoomOcultos = true;

    actualizarVisibilidadZoom();
}


/* ==========================================
   MOSTRAR CONTROLES DE ZOOM
========================================== */

function mostrarControlesZoom() {

    controlesZoomOcultos = false;

    actualizarVisibilidadZoom();
}


/* ==========================================
   ACTUALIZAR VISIBILIDAD DE CONTROLES
========================================== */

function actualizarVisibilidadZoom() {

    const esImagen = Boolean(obtenerImagenVisor());

    $("panelZoom").classList.toggle(
        "oculto",
        !esImagen || controlesZoomOcultos
    );

    $("btnMostrarZoom").classList.toggle(
        "oculto",
        !esImagen || !controlesZoomOcultos
    );
}


/* ==========================================
   PANTALLA COMPLETA
========================================== */

async function alternarPantallaCompleta() {

    const visor = $("visor");

    try {

        if (document.fullscreenElement === visor) {

            await document.exitFullscreen();

        } else {

            if (!visor.requestFullscreen) {

                alert(
                    "Este navegador no admite pantalla completa."
                );

                return;
            }

            await visor.requestFullscreen();
        }

    } catch (error) {

        console.error(
            "Error al cambiar pantalla completa:",
            error
        );

        alert(
            "No se pudo cambiar al modo de pantalla completa."
        );
    }
}


/* ==========================================
   ACTUALIZAR BOTON PANTALLA COMPLETA
========================================== */

function actualizarBotonPantallaCompleta() {

    const boton = $("btnPantallaCompleta");

    const activo =
        document.fullscreenElement === $("visor");

    boton.title = activo
        ? "Salir de pantalla completa"
        : "Activar pantalla completa";

    boton.setAttribute(
        "aria-label",
        boton.title
    );

    aplicarZoom();
}


/* ==========================================
   CONTROLES DEL TECLADO
========================================== */

function tecladoVisor(evento) {

    const visorAbierto = !$("visor")
        .classList.contains("oculto");

    if (evento.key === "Escape") {

        if (visorAbierto) {

            if (document.fullscreenElement === $("visor")) {
                return;
            }

            cerrarVisor();
        }

        if (typeof cerrarMenu === "function") {
            cerrarMenu();
        }

        return;
    }

    if (!visorAbierto) {
        return;
    }

    if (evento.key === "ArrowRight") {

        evento.preventDefault();

        cambiarVisor(1);
    }

    if (evento.key === "ArrowLeft") {

        evento.preventDefault();

        cambiarVisor(-1);
    }

    if (
        evento.key === "+" ||
        evento.key === "="
    ) {

        cambiarZoom(1);
    }

    if (evento.key === "-") {

        cambiarZoom(-1);
    }

    if (evento.key === "0") {

        restablecerZoom();
    }

    if (
        evento.key.toLowerCase() === "f" &&
        !evento.ctrlKey &&
        !evento.altKey &&
        !evento.metaKey
    ) {

        alternarPantallaCompleta();
    }
}


/* ==========================================
   INICIAR EVENTOS DEL VISOR
========================================== */

function iniciarEventosVisor() {

    /* CERRAR VISOR */

    $("cerrarVisor").addEventListener(
        "click",
        cerrarVisor
    );


    /* ARCHIVO ANTERIOR */

    $("anterior").addEventListener(
        "click",
        () => cambiarVisor(-1)
    );


    /* ARCHIVO SIGUIENTE */

    $("siguiente").addEventListener(
        "click",
        () => cambiarVisor(1)
    );


    /* AUMENTAR ZOOM */

    $("zoomMas").addEventListener(
        "click",
        () => cambiarZoom(1)
    );


    /* DISMINUIR ZOOM */

    $("zoomMenos").addEventListener(
        "click",
        () => cambiarZoom(-1)
    );


    /* RESTABLECER ZOOM */

    $("zoomReset").addEventListener(
        "click",
        restablecerZoom
    );


    /* OCULTAR CONTROLES */

    $("btnOcultarZoom").addEventListener(
        "click",
        ocultarControlesZoom
    );


    /* MOSTRAR CONTROLES */

    $("btnMostrarZoom").addEventListener(
        "click",
        mostrarControlesZoom
    );


    /* PANTALLA COMPLETA */

    $("btnPantallaCompleta").addEventListener(
        "click",
        alternarPantallaCompleta
    );


    /* DETECTAR CAMBIOS DE PANTALLA COMPLETA */

    document.addEventListener(
        "fullscreenchange",
        actualizarBotonPantallaCompleta
    );


    /* CERRAR AL HACER CLIC EN EL FONDO */

    $("visor").addEventListener(
        "click",
        evento => {

            if (evento.target === $("visor")) {

                cerrarVisor();
            }
        }
    );


    /* ZOOM Y ARRASTRE */

    const area = $("areaZoom");

    area.addEventListener(
        "wheel",
        zoomConRueda,
        { passive: false }
    );

    area.addEventListener(
        "pointerdown",
        iniciarArrastre
    );

    area.addEventListener(
        "pointermove",
        moverArrastre
    );

    area.addEventListener(
        "pointerup",
        terminarArrastre
    );

    area.addEventListener(
        "pointercancel",
        terminarArrastre
    );


    /* TECLADO */

    document.addEventListener(
        "keydown",
        tecladoVisor
    );


    /* CAMBIOS DE TAMAÑO */

    window.addEventListener(
        "resize",
        aplicarZoom
    );
}
