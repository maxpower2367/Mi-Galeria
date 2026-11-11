
/* ==========================================
   MI GALERIA - ELIMINACION SEGURA
   Archivo: eliminacion.js

   Carpetas: contraseña
   Archivos: miniatura y confirmacion
   Resultado: ventana de exito

   No elimina copias de Google Drive.
========================================== */

(function () {
    "use strict";

    let modal = null;
    let urlVistaPrevia = null;
    let procesando = false;
    let resolverModal = null;

    /* ==========================================
       ESTILOS
    ========================================== */

    function instalarEstilos() {
        if (document.getElementById("estilosEliminacion")) {
            return;
        }

        const estilo = document.createElement("style");
        estilo.id = "estilosEliminacion";

        estilo.textContent = `
            .eliminar-fondo {
                position: fixed;
                inset: 0;
                z-index: 99999;
                background: rgba(0,0,0,.82);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                box-sizing: border-box;
            }

            .eliminar-ventana {
                width: 100%;
                max-width: 440px;
                max-height: 90vh;
                overflow-y: auto;
                background: #202020;
                color: #fff;
                border: 1px solid #414141;
                border-radius: 16px;
                box-shadow: 0 20px 65px rgba(0,0,0,.6);
                padding: 26px;
                box-sizing: border-box;
                text-align: center;
                font-family: inherit;
            }

            .eliminar-icono {
                font-size: 40px;
                margin-bottom: 12px;
            }

            .eliminar-titulo {
                margin: 0 0 12px;
                font-size: 21px;
                color: #fff;
            }

            .eliminar-texto {
                color: #c5c5c5;
                line-height: 1.6;
                font-size: 14px;
                margin: 10px 0 18px;
                overflow-wrap: anywhere;
            }

            .eliminar-nombre {
                color: #fff;
                font-weight: bold;
                overflow-wrap: anywhere;
                margin: 12px 0;
            }

            .eliminar-preview {
                width: 100%;
                height: 205px;
                border-radius: 12px;
                background: #111;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                margin: 16px 0;
            }

            .eliminar-preview img,
            .eliminar-preview video {
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
            }

            .eliminar-preview span {
                color: #aaa;
                font-size: 14px;
            }

            .eliminar-password {
                width: 100%;
                padding: 13px;
                border: 1px solid #555;
                border-radius: 9px;
                background: #111;
                color: #fff;
                font-size: 15px;
                box-sizing: border-box;
                outline: none;
                margin-bottom: 10px;
            }

            .eliminar-password:focus {
                border-color: #999;
            }

            .eliminar-error {
                min-height: 20px;
                color: #ff7777;
                font-size: 13px;
                margin-bottom: 10px;
            }

            .eliminar-botones {
                display: flex;
                gap: 12px;
                justify-content: center;
                margin-top: 18px;
            }

            .eliminar-botones button {
                flex: 1;
                padding: 12px;
                border: 0;
                border-radius: 9px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
            }

            .eliminar-cancelar {
                background: #444;
                color: white;
            }

            .eliminar-confirmar {
                background: #c93434;
                color: white;
            }

            .eliminar-aceptar {
                background: #377bda;
                color: white;
            }

            .eliminar-botones button:hover {
                filter: brightness(1.15);
            }

            .eliminar-botones button:disabled {
                opacity: .5;
                cursor: wait;
            }

            @media (max-width: 480px) {
                .eliminar-ventana {
                    padding: 18px;
                }

                .eliminar-preview {
                    height: 170px;
                }
            }
        `;

        document.head.appendChild(estilo);
    }

    /* ==========================================
       CREAR VENTANA
    ========================================== */

    function crearVentana(titulo, texto, icono) {
        cerrarVentana();

        modal = document.createElement("div");
        modal.className = "eliminar-fondo";

        const ventana = document.createElement("div");
        ventana.className = "eliminar-ventana";
        ventana.setAttribute("role", "dialog");
        ventana.setAttribute("aria-modal", "true");

        const simbolo = document.createElement("div");
        simbolo.className = "eliminar-icono";
        simbolo.textContent = icono;

        const encabezado = document.createElement("h2");
        encabezado.className = "eliminar-titulo";
        encabezado.textContent = titulo;

        const descripcion = document.createElement("p");
        descripcion.className = "eliminar-texto";
        descripcion.textContent = texto;

        ventana.append(simbolo, encabezado, descripcion);
        modal.appendChild(ventana);
        document.body.appendChild(modal);

        return ventana;
    }

    function cerrarVentana() {
        if (resolverModal) {
            const resolver = resolverModal;
            resolverModal = null;
            resolver(false);
        }

        if (urlVistaPrevia) {
            URL.revokeObjectURL(urlVistaPrevia);
            urlVistaPrevia = null;
        }

        if (modal) {
            modal.remove();
            modal = null;
        }
    }

    function crearBoton(texto, clase, accion) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = clase;
        boton.textContent = texto;
        boton.addEventListener("click", accion);
        return boton;
    }

    function agregarBotones(ventana, botones) {
        const fila = document.createElement("div");
        fila.className = "eliminar-botones";

        botones.forEach(boton => fila.appendChild(boton));
        ventana.appendChild(fila);

        return fila;
    }

    /* ==========================================
       MINIATURA DEL ARCHIVO
    ========================================== */

    async function agregarVistaPrevia(ventana, archivo) {
        const contenedor = document.createElement("div");
        contenedor.className = "eliminar-preview";

        const nombre = document.createElement("div");
        nombre.className = "eliminar-nombre";
        nombre.textContent = archivo.nombre || "Archivo";

        ventana.append(contenedor, nombre);

        const esVideo = (archivo.tipo || "").startsWith("video/");

        try {
            let datos = archivo.datos;

            if (!(datos instanceof Blob)) {
                const drive = window.MiGaleriaGoogleDrive;

                if (
                    archivo.driveId &&
                    drive &&
                    drive.disponible() &&
                    typeof drive.descargarArchivo === "function"
                ) {
                    const aviso = document.createElement("span");
                    aviso.textContent = "Cargando vista previa...";
                    contenedor.appendChild(aviso);

                    datos = await drive.descargarArchivo(archivo.driveId);

                    aviso.remove();
                }
            }

            if (!(datos instanceof Blob)) {
                throw new Error("Sin vista previa disponible");
            }

            if (!modal || !ventana.isConnected) {
                return;
            }

            urlVistaPrevia = URL.createObjectURL(datos);

            if (esVideo) {
                const video = document.createElement("video");
                video.src = urlVistaPrevia;
                video.muted = true;
                video.playsInline = true;
                video.preload = "metadata";
                video.controls = true;

                contenedor.appendChild(video);
            } else {
                const imagen = document.createElement("img");
                imagen.src = urlVistaPrevia;
                imagen.alt = archivo.nombre || "Vista previa";
                contenedor.appendChild(imagen);
            }
        } catch (error) {
            console.warn("Vista previa no disponible:", error);

            const aviso = document.createElement("span");
            aviso.textContent = esVideo
                ? "Video sin vista previa"
                : "Imagen sin vista previa";

            contenedor.appendChild(aviso);
        }
    }

    /* ==========================================
       CONFIRMACION DE ARCHIVO
    ========================================== */

    function confirmarArchivo(archivo) {
        return new Promise(resolve => {
            const ventana = crearVentana(
                "¿Eliminar este archivo?",
                "Esta accion eliminara el archivo de la galeria local.",
                "🗑"
            );

            resolverModal = resolve;

            agregarVistaPrevia(ventana, archivo);

            agregarBotones(ventana, [
                crearBoton(
                    "No, cancelar",
                    "eliminar-cancelar",
                    () => cerrarVentana()
                ),
                crearBoton(
                    "Si, eliminar",
                    "eliminar-confirmar",
                    () => {
                        resolverModal = null;
                        cerrarVentana();
                        resolve(true);
                    }
                )
            ]);
        });
    }

    /* ==========================================
       CONFIRMACION CON CONTRASENA
    ========================================== */

    function confirmarCarpeta(carpeta) {
        return new Promise(resolve => {
            const ventana = crearVentana(
                "Eliminar carpeta",
                "Se eliminara esta carpeta, sus subcarpetas " +
                "y todos los archivos que contiene.",
                "🔒"
            );

            resolverModal = resolve;

            const nombre = document.createElement("div");
            nombre.className = "eliminar-nombre";
            nombre.textContent = carpeta.nombre;

            const indicacion = document.createElement("p");
            indicacion.className = "eliminar-texto";
            indicacion.textContent =
                "Introduce tu contraseña de inicio para confirmar.";

            const campo = document.createElement("input");
            campo.type = "password";
            campo.className = "eliminar-password";
            campo.placeholder = "Contraseña";
            campo.autocomplete = "off";

            const error = document.createElement("div");
            error.className = "eliminar-error";
            error.setAttribute("role", "alert");

            ventana.append(nombre, indicacion, campo, error);

            const confirmar = () => {
                const acceso = window.MiGaleriaAcceso;

                if (
                    !acceso ||
                    typeof acceso.verificarContrasena !== "function"
                ) {
                    error.textContent =
                        "No se pudo verificar la contraseña.";
                    return;
                }

                if (!acceso.verificarContrasena(campo.value)) {
                    error.textContent = "Contraseña incorrecta.";
                    campo.value = "";
                    campo.focus();
                    return;
                }

                resolverModal = null;
                cerrarVentana();
                resolve(true);
            };

            campo.addEventListener("keydown", evento => {
                if (evento.key === "Enter") {
                    evento.preventDefault();
                    confirmar();
                }
            });

            agregarBotones(ventana, [
                crearBoton(
                    "Cancelar",
                    "eliminar-cancelar",
                    () => cerrarVentana()
                ),
                crearBoton(
                    "Eliminar carpeta",
                    "eliminar-confirmar",
                    confirmar
                )
            ]);

            campo.focus();
        });
    }

    /* ==========================================
       CONFIRMACION MULTIPLE
    ========================================== */

    function confirmarMultiples(cantidad) {
        return new Promise(resolve => {
            const ventana = crearVentana(
                "Eliminar archivos",
                `¿Estas seguro de eliminar ${cantidad} archivos seleccionados?`,
                "🗑"
            );

            resolverModal = resolve;

            agregarBotones(ventana, [
                crearBoton(
                    "No, cancelar",
                    "eliminar-cancelar",
                    () => cerrarVentana()
                ),
                crearBoton(
                    "Si, eliminar",
                    "eliminar-confirmar",
                    () => {
                        resolverModal = null;
                        cerrarVentana();
                        resolve(true);
                    }
                )
            ]);
        });
    }

    /* ==========================================
       MENSAJE DE RESULTADO
    ========================================== */

    function mostrarResultado(titulo, mensaje, correcto = true) {
        return new Promise(resolve => {
            const ventana = crearVentana(
                titulo,
                mensaje,
                correcto ? "✓" : "!"
            );

            resolverModal = resolve;

            agregarBotones(ventana, [
                crearBoton(
                    "Aceptar",
                    "eliminar-aceptar",
                    () => {
                        resolverModal = null;
                        cerrarVentana();
                        resolve(true);
                    }
                )
            ]);
        });
    }

    /* ==========================================
       ELIMINAR ELEMENTO
    ========================================== */

    async function eliminarElementoSeguro() {
        if (procesando || !elementoSeleccionado) return;

        procesando = true;

        try {
            const { tipo, objeto } = elementoSeleccionado;

            if (typeof cerrarMenu === "function") {
                cerrarMenu();
            }

            const confirmado = tipo === "carpeta"
                ? await confirmarCarpeta(objeto)
                : await confirmarArchivo(objeto);

            if (!confirmado) return;

            if (tipo === "carpeta") {
                await eliminarCarpetaCompleta(objeto.id);
            } else {
                await eliminar("archivos", objeto.id);
                seleccionados.delete(objeto.id);
            }

            await mostrarContenido();

            await mostrarResultado(
                "Eliminacion completada",
                tipo === "carpeta"
                    ? `La carpeta "${objeto.nombre}" se elimino correctamente.`
                    : `El archivo "${objeto.nombre}" se elimino correctamente.`
            );

        } catch (error) {
            console.error("Error al eliminar:", error);

            await mostrarResultado(
                "No se pudo eliminar",
                error.message || "Ocurrio un error.",
                false
            );
        } finally {
            procesando = false;
        }
    }

    /* ==========================================
       ELIMINAR SELECCIONADOS
    ========================================== */

    async function eliminarSeleccionadosSeguro() {
        if (procesando || seleccionados.size === 0) return;

        procesando = true;

        try {
            const ids = new Set(seleccionados);
            const confirmado = await confirmarMultiples(ids.size);

            if (!confirmado) return;

            await ejecutarTransaccion(["archivos"], tx => {
                const almacen = tx.objectStore("archivos");

                ids.forEach(id => {
                    almacen.delete(id);
                });
            });

            seleccionados.clear();
            await mostrarContenido();

            await mostrarResultado(
                "Eliminacion completada",
                `Se eliminaron ${ids.size} archivos correctamente.`
            );

        } catch (error) {
            console.error("Error al eliminar archivos:", error);

            await mostrarResultado(
                "No se pudo eliminar",
                error.message || "Ocurrio un error.",
                false
            );
        } finally {
            procesando = false;
        }
    }

    /* ==========================================
       INTERCEPTAR BOTONES EXISTENTES
       SIN MODIFICAR galeria.js
    ========================================== */

    function iniciarEliminacionSegura() {
        instalarEstilos();

        document.addEventListener("click", evento => {
            const boton = evento.target.closest(
                "#opEliminar, #btnEliminarSeleccion"
            );

            if (!boton) return;

            // Evita ejecutar los manejadores antiguos.
            evento.preventDefault();
            evento.stopImmediatePropagation();

            if (boton.id === "opEliminar") {
                eliminarElementoSeguro();
            } else {
                eliminarSeleccionadosSeguro();
            }

        }, true);
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciarEliminacionSegura
        );
    } else {
        iniciarEliminacionSegura();
    }

})();
