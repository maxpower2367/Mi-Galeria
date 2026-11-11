
/* ==========================================
   MI GALERIA - PORTADAS DESDE GOOGLE DRIVE
   Archivo: portadas-drive.js
========================================== */

(function () {
    "use strict";

    const miniaturasPendientes = new WeakMap();

    /* ==========================================
       OBTENER MINIATURA DE DRIVE
    ========================================== */

    async function cargarImagenDrive(archivo, imagen) {

        if (!archivo?.driveId) return false;

        const drive = window.MiGaleriaGoogleDrive;

        if (
            !drive ||
            !drive.disponible() ||
            typeof drive.obtenerMiniatura !== "function"
        ) {
            return false;
        }

        try {

            const id = archivo.driveId;

            miniaturasPendientes.set(imagen, id);

            const url = await drive.obtenerMiniatura(id);

            if (
                !url ||
                !imagen.isConnected ||
                miniaturasPendientes.get(imagen) !== id
            ) {
                return false;
            }

            imagen.src = url;

            return true;

        } catch (error) {

            console.warn(
                "No se pudo cargar la portada:",
                error
            );

            return false;
        }
    }

    /* ==========================================
       ACTUALIZAR PORTADAS DE CARPETAS
    ========================================== */

    async function actualizarPortadasDrive() {

        const drive = window.MiGaleriaGoogleDrive;

        if (!drive || !drive.disponible()) {
            return;
        }

        if (
            typeof obtenerTodos !== "function" ||
            typeof obtenerPortada !== "function"
        ) {
            return;
        }

        const carpetas = await obtenerTodos("carpetas");
        const archivos = await obtenerTodos("archivos");

        const visibles = carpetas.filter(c =>
            c.padre === carpetaActual &&
            !c.portadaSinImagen
        );

        const elementos = document.querySelectorAll(
            "#carpetas .carpeta"
        );

        const ordenadas = typeof ordenarElementos === "function"
            ? ordenarElementos(
                visibles.filter(c =>
                    typeof coincideBusqueda !== "function" ||
                    coincideBusqueda(c.nombre)
                )
            )
            : visibles;

        elementos.forEach((elemento, indice) => {

            const carpeta = ordenadas[indice];

            if (!carpeta) return;

            const portada = elemento.querySelector(
                ".carpeta-portada"
            );

            if (!portada) return;

            let archivo = null;

            if (carpeta.portadaArchivoId) {

                archivo = archivos.find(a =>
                    a.id === carpeta.portadaArchivoId &&
                    a.carpeta === carpeta.id &&
                    a.tipo?.startsWith("image/")
                );

            } else if (
                !(carpeta.portadaPersonalizada instanceof Blob)
            ) {

                archivo = obtenerPortada(
                    carpeta.id,
                    archivos
                );
            }

            if (
                !archivo ||
                archivo.datos instanceof Blob ||
                !archivo.driveId
            ) {
                return;
            }

            const imagen = document.createElement("img");

            imagen.alt = "Portada de " + carpeta.nombre;
            imagen.loading = "lazy";

            portada.replaceChildren(imagen);

            cargarImagenDrive(archivo, imagen);
        });
    }

    /* ==========================================
       INTERCEPTAR ACTUALIZACION DE CONTENIDO
    ========================================== */

    function iniciarPortadasDrive() {

        if (typeof mostrarContenido !== "function") {
            return;
        }

        const mostrarContenidoOriginal = mostrarContenido;

        mostrarContenido = async function (...argumentos) {

            const resultado = await mostrarContenidoOriginal(
                ...argumentos
            );

            await actualizarPortadasDrive();

            return resultado;
        };

        window.addEventListener(
            "miGaleriaDriveConectado",
            () => {
                actualizarPortadasDrive().catch(
                    console.error
                );
            }
        );
    }

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            iniciarPortadasDrive
        );

    } else {

        iniciarPortadasDrive();
    }

})();
