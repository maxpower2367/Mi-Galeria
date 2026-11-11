
/* ==========================================
   MI GALERIA - VISOR MULTIMEDIA
   Archivo: visor.js
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
let eventosVisorIniciados = false;
let generacionVisor = 0;

const ZOOM_MINIMO = 1;
const ZOOM_MAXIMO = 5;
const ZOOM_PASO = 0.25;

/* ==========================================
   FUNCIONES GENERALES
========================================== */

function elementoVisor(id) {
    return document.getElementById(id);
}

function archivoActualVisor() {
    if (
        indiceVisor < 0 ||
        indiceVisor >= archivosVisibles.length
    ) {
        return null;
    }

    return archivosVisibles[indiceVisor];
}

function obtenerImagenVisor() {
    return elementoVisor("contenidoVisor")
        ?.querySelector("img") || null;
}

function obtenerVideoVisor() {
    return elementoVisor("contenidoVisor")
        ?.querySelector("video") || null;
}

/* ==========================================
   ABRIR VISOR
========================================== */

function abrirVisor(id) {
    indiceVisor = archivosVisibles.findIndex(
        archivo => archivo.id === id
    );

    if (indiceVisor === -1) return;

    controlesZoomOcultos = false;

    elementoVisor("visor").classList.remove("oculto");

    mostrarArchivoVisor();
}

/* ==========================================
   OBTENER ARCHIVO LOCAL O DESDE DRIVE
========================================== */

async function obtenerBlobVisor(archivo) {
    if (archivo.datos instanceof Blob) {
        return archivo.datos;
    }

    const drive = window.MiGaleriaGoogleDrive;

    if (
        !archivo.driveId ||
        !drive ||
        typeof drive.disponible !== "function" ||
        !drive.disponible() ||
        typeof drive.descargarArchivo !== "function"
    ) {
        throw new Error(
            "El archivo no esta disponible localmente " +
            "y Google Drive no esta conectado."
        );
    }

    const resultado = await drive.descargarArchivo(
        archivo.driveId
    );

    if (resultado instanceof Blob) {
        return resultado;
    }

    if (resultado instanceof ArrayBuffer) {
        return new Blob([resultado], {
            type: archivo.tipo || ""
        });
    }

    throw new Error(
        "Google Drive no devolvio un archivo compatible."
    );
}

/* ==========================================
   MOSTRAR ARCHIVO EN EL VISOR
========================================== */

async function mostrarArchivoVisor() {
    const archivo = archivoActualVisor();

    if (!archivo) return;

    const generacion = ++generacionVisor;
    const contenedor = elementoVisor("contenidoVisor");

    const videoAnterior = obtenerVideoVisor();

    if (videoAnterior) {
        videoAnterior.pause();
    }

    terminarArrastre();
    restablecerControlesVideoVisor();

    contenedor.replaceChildren();

    if (urlVisor) {
        URL.revokeObjectURL(urlVisor);
        urlVisor = null;
    }

    elementoVisor("nombreVisor").textContent =
        archivo.nombre || "Archivo";

    const esVideo = (archivo.tipo || "")
        .startsWith("video/");

    elementoVisor("panelVideo")?.classList.toggle(
        "oculto",
        !esVideo
    );

    restablecerZoom();
    actualizarVisibilidadZoom();

    const botonDescarga = elementoVisor(
        "btnDescargarVisor"
    );

    if (botonDescarga) {
        botonDescarga.disabled = false;
    }

    try {
        const datos = await obtenerBlobVisor(archivo);

        if (generacion !== generacionVisor) {
            return;
        }

        urlVisor = URL.createObjectURL(datos);

        let multimedia;

        if (esVideo) {
            multimedia = document.createElement("video");

            multimedia.controls = false;
            multimedia.autoplay = true;
            multimedia.playsInline = true;
            multimedia.preload = "metadata";
            multimedia.style.objectFit = "contain";

            [
                "loadedmetadata",
                "timeupdate",
                "durationchange",
                "play",
                "pause",
                "volumechange",
                "ended"
            ].forEach(evento => {
                multimedia.addEventListener(
                    evento,
                    actualizarControlesVideo
                );
            });

            multimedia.addEventListener(
                "click",
                alternarReproduccionVideo
            );

        } else {
            multimedia = document.createElement("img");

            multimedia.alt = archivo.nombre || "Imagen";
            multimedia.draggable = false;

            multimedia.addEventListener(
                "load",
                aplicarZoom,
                { once: true }
            );
        }

        multimedia.src = urlVisor;
        contenedor.appendChild(multimedia);

        if (esVideo) {
            reiniciarControlesVideo();
            prepararBotonControlesVideo();

            multimedia.play().catch(() => {
                actualizarControlesVideo();
            });
        }

        aplicarZoom();

    } catch (error) {
        if (generacion !== generacionVisor) {
            return;
        }

        console.error(
            "No se pudo abrir el archivo:",
            error
        );

        const aviso = document.createElement("p");

        aviso.textContent =
            "No se pudo abrir el archivo: " +
            error.message;

        aviso.style.cssText =
            "color:white;padding:20px;text-align:center";

        contenedor.appendChild(aviso);

        elementoVisor("panelVideo")
            ?.classList.add("oculto");

        restablecerControlesVideoVisor();
    }
}

/* ==========================================
   NAVEGACION ENTRE ARCHIVOS
========================================== */

function cambiarVisor(direccion) {
    if (
        !archivosVisibles.length ||
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
    ++generacionVisor;

    const visor = elementoVisor("visor");

    if (document.fullscreenElement === visor) {
        document.exitFullscreen().catch(
            console.error
        );
    }

    const video = obtenerVideoVisor();

    if (video) {
        video.pause();
    }

    terminarArrastre();
    restablecerControlesVideoVisor();

    elementoVisor("contenidoVisor")
        .replaceChildren();

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

    elementoVisor("panelVideo")
        ?.classList.add("oculto");

    actualizarVisibilidadZoom();
}

/* ==========================================
   LIMITAR DESPLAZAMIENTO DE IMAGEN
========================================== */

function limitarDesplazamiento() {
    const imagen = obtenerImagenVisor();
    const area = elementoVisor("areaZoom");

    if (!imagen || !area || nivelZoom <= 1) {
        desplazamientoX = 0;
        desplazamientoY = 0;
        return;
    }

    const limiteX = Math.max(
        0,
        (
            imagen.offsetWidth * nivelZoom -
            area.clientWidth
        ) / 2
    );

    const limiteY = Math.max(
        0,
        (
            imagen.offsetHeight * nivelZoom -
            area.clientHeight
        ) / 2
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

    const porcentaje = elementoVisor(
        "porcentajeZoom"
    );

    const menos = elementoVisor("zoomMenos");
    const mas = elementoVisor("zoomMas");

    if (porcentaje) {
        porcentaje.textContent =
            `${Math.round(nivelZoom * 100)}%`;
    }

    if (menos) {
        menos.disabled = nivelZoom <= ZOOM_MINIMO;
    }

    if (mas) {
        mas.disabled = nivelZoom >= ZOOM_MAXIMO;
    }

    if (!imagen) return;

    limitarDesplazamiento();

    imagen.style.transform =
        `translate(${desplazamientoX}px, ` +
        `${desplazamientoY}px) ` +
        `scale(${nivelZoom})`;

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
    if (!obtenerImagenVisor()) return;

    nivelZoom = Math.max(
        ZOOM_MINIMO,
        Math.min(
            ZOOM_MAXIMO,
            Math.round(
                (
                    nivelZoom +
                    direccion * ZOOM_PASO
                ) * 100
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
   ARRASTRE DE IMAGENES
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

    imagen.setPointerCapture(
        evento.pointerId
    );

    aplicarZoom();
    evento.preventDefault();
}

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

function terminarArrastre() {
    const imagen = obtenerImagenVisor();

    if (
        imagen &&
        punteroActivo !== null &&
        imagen.hasPointerCapture(punteroActivo)
    ) {
        imagen.releasePointerCapture(
            punteroActivo
        );
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
    if (!obtenerImagenVisor()) return;

    evento.preventDefault();

    cambiarZoom(
        evento.deltaY < 0 ? 1 : -1
    );
}

/* ==========================================
   OCULTAR Y MOSTRAR ZOOM
========================================== */

function ocultarControlesZoom() {
    controlesZoomOcultos = true;
    actualizarVisibilidadZoom();
}

function mostrarControlesZoom() {
    controlesZoomOcultos = false;
    actualizarVisibilidadZoom();
}

function actualizarVisibilidadZoom() {
    const archivo = archivoActualVisor();

    const esVideo = Boolean(
        archivo &&
        (archivo.tipo || "").startsWith("video/")
    );

    const esImagen = Boolean(archivo) && !esVideo;

    const panel = elementoVisor("panelZoom");
    const mostrar = elementoVisor("btnMostrarZoom");

    if (panel) {
        panel.classList.toggle(
            "oculto",
            !esImagen || controlesZoomOcultos
        );
    }

    if (mostrar) {
        mostrar.classList.toggle(
            "oculto",
            !esImagen || !controlesZoomOcultos
        );
    }

    [
        "zoomMenos",
        "zoomMas",
        "zoomReset",
        "porcentajeZoom"
    ].forEach(id => {
        const elemento = elementoVisor(id);

        if (elemento) {
            elemento.style.display =
                esImagen ? "" : "none";
        }
    });
}

/* ==========================================
   PANTALLA COMPLETA
========================================== */

async function alternarPantallaCompleta() {
    const visor = elementoVisor("visor");

    try {
        if (document.fullscreenElement === visor) {
            await document.exitFullscreen();

        } else if (visor.requestFullscreen) {
            await visor.requestFullscreen();

        } else {
            alert(
                "Este navegador no admite pantalla completa."
            );
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

function actualizarBotonPantallaCompleta() {
    const boton = elementoVisor(
        "btnPantallaCompleta"
    );

    if (!boton) return;

    const activo =
        document.fullscreenElement ===
        elementoVisor("visor");

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
   FORMATO DE TIEMPO DE VIDEO
========================================== */

function formatoTiempoVideo(segundos) {
    if (
        !Number.isFinite(segundos) ||
        segundos < 0
    ) {
        return "00:00";
    }

    const total = Math.floor(segundos);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor(
        (total % 3600) / 60
    );
    const resto = total % 60;

    if (horas > 0) {
        return (
            `${horas}:` +
            `${String(minutos).padStart(2, "0")}:` +
            `${String(resto).padStart(2, "0")}`
        );
    }

    return (
        `${String(minutos).padStart(2, "0")}:` +
        `${String(resto).padStart(2, "0")}`
    );
}

/* ==========================================
   REINICIAR CONTROLES DE VIDEO
========================================== */

function reiniciarControlesVideo() {
    const progreso = elementoVisor(
        "videoProgreso"
    );

    const volumen = elementoVisor(
        "videoVolumen"
    );

    const velocidad = elementoVisor(
        "videoVelocidad"
    );

    const ajuste = elementoVisor(
        "videoAjuste"
    );

    if (progreso) {
        progreso.value = "0";
        progreso.max = "100";
    }

    if (volumen) volumen.value = "1";
    if (velocidad) velocidad.value = "1";
    if (ajuste) ajuste.value = "contener";

    actualizarControlesVideo();
}

/* ==========================================
   ACTUALIZAR CONTROLES DE VIDEO
========================================== */

function actualizarControlesVideo() {
    const video = obtenerVideoVisor();

    if (!video) return;

    const duracion = Number.isFinite(video.duration)
        ? video.duration
        : 0;

    const progreso = elementoVisor(
        "videoProgreso"
    );

    const tiempo = elementoVisor(
        "videoTiempo"
    );

    const play = elementoVisor(
        "videoPlay"
    );

    const mute = elementoVisor(
        "videoMute"
    );

    const volumen = elementoVisor(
        "videoVolumen"
    );

    if (progreso) {
        progreso.max = String(duracion || 100);

        progreso.value = String(
            Math.min(
                video.currentTime || 0,
                duracion || 100
            )
        );

        progreso.disabled = !duracion;
    }

    if (tiempo) {
        tiempo.textContent =
            `${formatoTiempoVideo(video.currentTime)} / ` +
            formatoTiempoVideo(duracion);
    }

    if (play) {
        play.textContent =
            video.paused ? "▶" : "❚❚";

        play.title = video.paused
            ? "Reproducir"
            : "Pausar";
    }

    if (mute) {
        mute.textContent =
            video.muted || video.volume === 0
                ? "🔇"
                : "🔊";

        mute.title =
            video.muted || video.volume === 0
                ? "Activar audio"
                : "Silenciar";
    }

    if (volumen) {
        volumen.value = String(
            video.muted ? 0 : video.volume
        );
    }
}

/* ==========================================
   REPRODUCIR Y PAUSAR VIDEO
========================================== */

function alternarReproduccionVideo() {
    const video = obtenerVideoVisor();

    if (!video) return;

    if (video.paused) {
        video.play().catch(error => {
            console.warn(
                "No se pudo reproducir:",
                error
            );
        });

    } else {
        video.pause();
    }
}

/* ==========================================
   ADELANTAR O RETROCEDER VIDEO
========================================== */

function cambiarProgresoVideo(valor) {
    const video = obtenerVideoVisor();

    if (
        !video ||
        !Number.isFinite(video.duration)
    ) {
        return;
    }

    video.currentTime = Math.max(
        0,
        Math.min(
            video.duration,
            Number(valor)
        )
    );

    actualizarControlesVideo();
}

/* ==========================================
   VOLUMEN
========================================== */

function cambiarVolumenVideo(valor) {
    const video = obtenerVideoVisor();

    if (!video) return;

    video.volume = Math.max(
        0,
        Math.min(1, Number(valor))
    );

    video.muted = video.volume === 0;

    actualizarControlesVideo();
}

function alternarSilencioVideo() {
    const video = obtenerVideoVisor();

    if (!video) return;

    video.muted = !video.muted;

    actualizarControlesVideo();
}

/* ==========================================
   VELOCIDAD DE VIDEO
========================================== */

function cambiarVelocidadVideo(valor) {
    const video = obtenerVideoVisor();

    if (!video) return;

    video.playbackRate = Number(valor) || 1;
}

/* ==========================================
   AJUSTE DEL VIDEO
========================================== */

function cambiarAjusteVideo(valor) {
    const video = obtenerVideoVisor();

    if (!video) return;

    video.style.objectFit =
        valor === "cubrir"
            ? "cover"
            : "contain";

    if (valor === "original") {
        video.style.width = "auto";
        video.style.height = "auto";
        video.style.maxWidth = "100%";
        video.style.maxHeight = "100%";

    } else {
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.maxWidth = "100%";
        video.style.maxHeight = "100%";
    }
}

/* ==========================================
   DESCARGAR ARCHIVO
========================================== */

async function descargarArchivoVisor() {
    const archivo = archivoActualVisor();

    if (!archivo) return;

    const botones = [
        elementoVisor("btnDescargarVisor"),
        elementoVisor("videoDescargar")
    ].filter(Boolean);

    botones.forEach(boton => {
        boton.disabled = true;
    });

    try {
        const datos = await obtenerBlobVisor(
            archivo
        );

        const url = URL.createObjectURL(datos);

        const enlace = document.createElement("a");

        enlace.href = url;
        enlace.download =
            archivo.nombre || "archivo";

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 60000);

    } catch (error) {
        console.error(
            "Error al descargar archivo:",
            error
        );

        alert(
            "No se pudo descargar el archivo.\n" +
            error.message
        );

    } finally {
        botones.forEach(boton => {
            boton.disabled = false;
        });
    }
}

/* ==========================================
   BOTON DESCARGAR IMAGEN
========================================== */

function iniciarBotonDescargaVisor() {
    if (elementoVisor("btnDescargarVisor")) {
        return;
    }

    const botonOcultar = elementoVisor(
        "btnOcultarZoom"
    );

    if (!botonOcultar) return;

    const boton = document.createElement("button");

    boton.id = "btnDescargarVisor";
    boton.type = "button";
    boton.title = "Descargar archivo";

    boton.setAttribute(
        "aria-label",
        boton.title
    );

    boton.textContent = "↓";

    botonOcultar.before(boton);
}

/* ==========================================
   RESTABLECER CONTROLES DE VIDEO
========================================== */

function restablecerControlesVideoVisor() {
    const visor = elementoVisor("visor");

    const boton = elementoVisor(
        "btnOcultarControlesVideo"
    );

    if (visor) {
        visor.classList.remove(
            "video-controles-ocultos"
        );
    }

    if (boton) {
        boton.textContent = "▼";
        boton.title =
            "Ocultar controles del video";

        boton.setAttribute(
            "aria-label",
            boton.title
        );

        boton.hidden = true;
    }
}

/* ==========================================
   MOSTRAR U OCULTAR CONTROLES DE VIDEO
========================================== */

function alternarControlesVideoVisor() {
    const visor = elementoVisor("visor");

    const boton = elementoVisor(
        "btnOcultarControlesVideo"
    );

    const video = obtenerVideoVisor();

    if (!visor || !boton || !video) return;

    const ocultos = visor.classList.toggle(
        "video-controles-ocultos"
    );

    boton.textContent = ocultos ? "▲" : "▼";

    boton.title = ocultos
        ? "Mostrar controles del video"
        : "Ocultar controles del video";

    boton.setAttribute(
        "aria-label",
        boton.title
    );
}

/* ==========================================
   PREPARAR BOTON DE CONTROLES DE VIDEO
========================================== */

function prepararBotonControlesVideo() {
    const visor = elementoVisor("visor");

    const panel =
        elementoVisor("panelVideo") ||
        visor?.querySelector(".panel-video");

    const video = obtenerVideoVisor();

    if (!visor || !panel || !video) return;

    let boton = elementoVisor(
        "btnOcultarControlesVideo"
    );

    if (!boton) {
        boton = document.createElement("button");

        boton.id = "btnOcultarControlesVideo";
        boton.type = "button";
        boton.className = "boton-ocultar-video";

        boton.addEventListener(
            "click",
            alternarControlesVideoVisor
        );

        visor.appendChild(boton);
    }

    boton.hidden = false;
    boton.textContent = "▼";
    boton.title = "Ocultar controles del video";

    boton.setAttribute(
        "aria-label",
        boton.title
    );
}

/* ==========================================
   ESTILOS DE CONTROLES DE VIDEO
========================================== */

function iniciarEstilosControlesVideo() {
    if (elementoVisor("estilosOcultarVideo")) {
        return;
    }

    const estilo = document.createElement("style");

    estilo.id = "estilosOcultarVideo";

    estilo.textContent = `
        #visor .boton-ocultar-video {
            position: absolute;
            bottom: 5px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1010;

            display: flex;
            align-items: center;
            justify-content: center;

            width: 44px;
            height: 28px;

            border: 1px solid #555;
            border-radius: 8px;

            background: rgba(35,35,35,0.92);
            color: white;

            font-size: 17px;
            cursor: pointer;
        }

        #visor .boton-ocultar-video[hidden] {
            display: none !important;
        }

        #visor.video-controles-ocultos .panel-video,
        #visor.video-controles-ocultos #panelVideo {
            display: none !important;
        }

        #visor.video-controles-ocultos
        .boton-ocultar-video {
            bottom: 12px;
        }

        @media (max-height: 500px)
        and (orientation: landscape) {

            #visor .boton-ocultar-video {
                bottom: 2px;
                height: 24px;
            }

            #visor.video-controles-ocultos
            .boton-ocultar-video {
                bottom: 7px;
            }
        }
    `;

    document.head.appendChild(estilo);
}

/* ==========================================
   TECLADO
========================================== */

function tecladoVisor(evento) {
    const visor = elementoVisor("visor");

    const visorAbierto =
        visor &&
        !visor.classList.contains("oculto");

    if (evento.key === "Escape") {
        if (
            visorAbierto &&
            document.fullscreenElement !== visor
        ) {
            cerrarVisor();
        }

        if (typeof cerrarMenu === "function") {
            cerrarMenu();
        }

        return;
    }

    if (!visorAbierto) return;

    const etiqueta = evento.target?.tagName;

    if (
        ["INPUT", "SELECT", "TEXTAREA"]
            .includes(etiqueta) ||
        evento.target?.isContentEditable
    ) {
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
        evento.preventDefault();
        alternarPantallaCompleta();
    }

    if (
        evento.code === "Space" &&
        obtenerVideoVisor()
    ) {
        evento.preventDefault();
        alternarReproduccionVideo();
    }
}

/* ==========================================
   CERRAR VISOR AL HACER CLIC EN EL FONDO

   FUNCION NUEVA:
   - Cierra desde los espacios negros.
   - No cierra al pulsar la imagen.
   - No cierra al pulsar el video.
   - No interfiere con los controles.
========================================== */

function cerrarVisorDesdeFondo(evento) {
    const visor = elementoVisor("visor");

    if (
        !visor ||
        visor.classList.contains("oculto")
    ) {
        return;
    }

    // Solo el boton principal del mouse.
    if (
        evento.button !== undefined &&
        evento.button !== 0
    ) {
        return;
    }

    const objetivo = evento.target;

    const area = elementoVisor("areaZoom");
    const contenido = elementoVisor(
        "contenidoVisor"
    );

    // No cerrar si se pulsa directamente
    // una imagen, GIF o video.
    if (
        objetivo.closest?.(
            "#contenidoVisor img, " +
            "#contenidoVisor video"
        )
    ) {
        return;
    }

    // No cerrar si se pulsa un control.
    if (
        objetivo.closest?.(
            "button, input, select, " +
            "textarea, a, label, " +
            "#panelZoom, #panelVideo, " +
            ".panel-video, " +
            "#btnMostrarZoom, " +
            "#btnOcultarControlesVideo"
        )
    ) {
        return;
    }

    // Cerrar solamente al pulsar
    // una superficie vacia del visor.
    if (
        objetivo === visor ||
        objetivo === area ||
        objetivo === contenido
    ) {
        cerrarVisor();
    }
}

/* ==========================================
   INICIAR EVENTOS DEL VISOR
========================================== */

function iniciarEventosVisor() {
    if (eventosVisorIniciados) return;

    eventosVisorIniciados = true;

    iniciarBotonDescargaVisor();
    iniciarEstilosControlesVideo();

    /* CERRAR CON X */

    elementoVisor("cerrarVisor")
        ?.addEventListener(
            "click",
            cerrarVisor
        );

    /* NAVEGACION */

    elementoVisor("anterior")
        ?.addEventListener(
            "click",
            () => cambiarVisor(-1)
        );

    elementoVisor("siguiente")
        ?.addEventListener(
            "click",
            () => cambiarVisor(1)
        );

    /* ZOOM */

    elementoVisor("zoomMas")
        ?.addEventListener(
            "click",
            () => cambiarZoom(1)
        );

    elementoVisor("zoomMenos")
        ?.addEventListener(
            "click",
            () => cambiarZoom(-1)
        );

    elementoVisor("zoomReset")
        ?.addEventListener(
            "click",
            restablecerZoom
        );

    elementoVisor("btnOcultarZoom")
        ?.addEventListener(
            "click",
            ocultarControlesZoom
        );

    elementoVisor("btnMostrarZoom")
        ?.addEventListener(
            "click",
            mostrarControlesZoom
        );

    /* PANTALLA COMPLETA */

    elementoVisor("btnPantallaCompleta")
        ?.addEventListener(
            "click",
            alternarPantallaCompleta
        );

    /* DESCARGAS */

    elementoVisor("btnDescargarVisor")
        ?.addEventListener(
            "click",
            descargarArchivoVisor
        );

    elementoVisor("videoDescargar")
        ?.addEventListener(
            "click",
            descargarArchivoVisor
        );

    /* CONTROLES DE VIDEO */

    elementoVisor("videoPlay")
        ?.addEventListener(
            "click",
            alternarReproduccionVideo
        );

    elementoVisor("videoMute")
        ?.addEventListener(
            "click",
            alternarSilencioVideo
        );

    elementoVisor("videoProgreso")
        ?.addEventListener(
            "input",
            evento => cambiarProgresoVideo(
                evento.target.value
            )
        );

    elementoVisor("videoVolumen")
        ?.addEventListener(
            "input",
            evento => cambiarVolumenVideo(
                evento.target.value
            )
        );

    elementoVisor("videoVelocidad")
        ?.addEventListener(
            "change",
            evento => cambiarVelocidadVideo(
                evento.target.value
            )
        );

    elementoVisor("videoAjuste")
        ?.addEventListener(
            "change",
            evento => cambiarAjusteVideo(
                evento.target.value
            )
        );

    /* CAMBIOS DE PANTALLA COMPLETA */

    document.addEventListener(
        "fullscreenchange",
        actualizarBotonPantallaCompleta
    );

    /* ======================================
       NUEVO: CERRAR DESDE EL FONDO NEGRO
    ====================================== */

    elementoVisor("visor")
        ?.addEventListener(
            "click",
            cerrarVisorDesdeFondo
        );

    /* ARRASTRE Y RUEDA */

    const area = elementoVisor("areaZoom");

    area?.addEventListener(
        "wheel",
        zoomConRueda,
        { passive: false }
    );

    area?.addEventListener(
        "pointerdown",
        iniciarArrastre
    );

    area?.addEventListener(
        "pointermove",
        moverArrastre
    );

    area?.addEventListener(
        "pointerup",
        terminarArrastre
    );

    area?.addEventListener(
        "pointercancel",
        terminarArrastre
    );

    /* TECLADO */

    document.addEventListener(
        "keydown",
        tecladoVisor
    );

    /* CAMBIO DE TAMAÑO */

    window.addEventListener(
        "resize",
        aplicarZoom
    );
}

/* ==========================================
   INICIALIZACION DE ESTILOS
========================================== */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        iniciarEstilosControlesVideo
    );

} else {
    iniciarEstilosControlesVideo();
}
