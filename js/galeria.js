
/* ==========================================
   MI GALERIA - ADMINISTRACION DE ARCHIVOS
   Archivo: galeria.js
========================================== */

/* ==========================================
   VARIABLES DE LA GALERIA
========================================== */

let carpetaActual = null;
let elementoSeleccionado = null;

let seleccionados = new Set();
let archivosVisibles = [];

let ordenActual = "fecha-desc";
let busquedaActual = "";

let urlsMiniaturas = [];

const galeria = $("galeria");
const menuContextual = $("menuContextual");

/* ==========================================
   MOSTRAR CONTENIDO
========================================== */

async function mostrarContenido() {
    const carpetas = await obtenerTodos("carpetas");
    const archivos = await obtenerTodos("archivos");

    const carpeta = carpetas.find(
        c => c.id === carpetaActual
    );

    $("titulo").textContent = carpeta
        ? carpeta.nombre
        : "Inicio";

    limpiarMiniaturas();

    mostrarRuta(carpetas);
    mostrarArbol(carpetas);
    mostrarCarpetas(carpetas, archivos);
    mostrarArchivos(archivos);

    actualizarBarraSeleccion();
    await actualizarBarraEstado();
}

/* ==========================================
   ORDENAR ELEMENTOS
========================================== */

function ordenarElementos(elementos) {
    return [...elementos].sort((a, b) => {
        switch (ordenActual) {
            case "nombre-asc":
                return a.nombre.localeCompare(b.nombre);

            case "nombre-desc":
                return b.nombre.localeCompare(a.nombre);

            case "fecha-asc":
                return (a.fecha || 0) - (b.fecha || 0);

            case "tipo":
                return (a.tipo || "").localeCompare(b.tipo || "")
                    || a.nombre.localeCompare(b.nombre);

            default:
                return (b.fecha || 0) - (a.fecha || 0);
        }
    });
}

/* ==========================================
   BUSCADOR
========================================== */

function coincideBusqueda(nombre) {
    return nombre.toLowerCase().includes(
        busquedaActual
    );
}

/* ==========================================
   LIMPIAR MINIATURAS
========================================== */

function limpiarMiniaturas() {
    urlsMiniaturas.forEach(url => {
        URL.revokeObjectURL(url);
    });

    urlsMiniaturas = [];
}

/* ==========================================
   MOSTRAR ARCHIVOS
   INDEXEDDB + GOOGLE DRIVE
========================================== */

/* Control de cargas de la vista actual. */
let observadorMiniaturasDrive = null;
let versionMiniaturasDrive = 0;

function mostrarArchivos(archivos) {

    // Invalidar trabajos de carpetas anteriores.
    const version = ++versionMiniaturasDrive;

    if (observadorMiniaturasDrive) {
        observadorMiniaturasDrive.disconnect();
        observadorMiniaturasDrive = null;
    }

    galeria.innerHTML = "";

    archivosVisibles = ordenarElementos(
        archivos.filter(archivo =>
            archivo.carpeta === carpetaActual &&
            coincideBusqueda(archivo.nombre)
        )
    );

    if (archivosVisibles.length === 0) {
        const mensaje = document.createElement("p");

        mensaje.className = "vacio";
        mensaje.textContent = "No hay archivos para mostrar.";

        galeria.appendChild(mensaje);
        return;
    }

    const drive = window.MiGaleriaGoogleDrive;
    const pendientes = [];

    let activas = 0;

    function vistaValida(imagen) {
        return (
            version === versionMiniaturasDrive &&
            imagen.isConnected
        );
    }

    /* ======================================
       TARJETA ALTERNATIVA PARA VIDEOS
    ====================================== */

    function mostrarVideoSinMiniatura(imagen, archivo) {

        if (!vistaValida(imagen)) return;

        const tarjeta = document.createElement("div");

        tarjeta.className = "miniatura-video-alternativa";

        tarjeta.style.cssText =
            "display:flex;flex-direction:column;align-items:center;" +
            "justify-content:center;gap:10px;width:100%;height:100%;" +
            "min-height:130px;background:#252525;color:#eeeeee;" +
            "text-align:center;box-sizing:border-box;padding:12px;";

        const reproducir = document.createElement("span");

        reproducir.textContent = "▶";

        reproducir.style.cssText =
            "font-size:42px;line-height:1;color:#ffffff;";

        const etiqueta = document.createElement("span");

        etiqueta.textContent = "Video";

        etiqueta.style.cssText =
            "font-size:13px;color:#bbbbbb;";

        tarjeta.append(reproducir, etiqueta);

        tarjeta.title = "Abrir video: " + archivo.nombre;

        imagen.replaceWith(tarjeta);
    }

    /* ======================================
       CARGAR ARCHIVO DESDE GOOGLE DRIVE
    ====================================== */

    async function cargarArchivoDrive(archivo, imagen) {

        if (!vistaValida(imagen)) return;

        if (!drive?.disponible?.()) {

            imagen.title =
                "Conecta Google Drive para ver la miniatura";

            return;
        }


/* ======================================
   MINIATURA DE VIDEO DESDE GOOGLE DRIVE
====================================== */

if ((archivo.tipo || "").startsWith("video/")) {

    try {

        const url =
            typeof drive.obtenerMiniatura === "function"
                ? await drive.obtenerMiniatura(
                    archivo.driveId
                )
                : null;

        if (!vistaValida(imagen)) return;

        if (url) {

            imagen.onerror = () => {

                imagen.onerror = null;

                mostrarVideoSinMiniatura(
                    imagen,
                    archivo
                );
            };

            imagen.src = url;
            imagen.title = archivo.nombre;

        } else {

            mostrarVideoSinMiniatura(
                imagen,
                archivo
            );
        }

    } catch (error) {

        console.warn(
            "Error cargando miniatura de video:",
            archivo.nombre,
            error
        );

        if (vistaValida(imagen)) {

            mostrarVideoSinMiniatura(
                imagen,
                archivo
            );
        }
    }

    return;
}


        /* DESCARGAR ORIGINAL SI FALLA MINIATURA */

        async function cargarOriginal() {

            if (!vistaValida(imagen)) return;

            try {

                if (
                    typeof drive.descargarArchivo !== "function"
                ) {
                    throw new Error(
                        "Descarga de Drive no disponible"
                    );
                }

                const blob = await drive.descargarArchivo(
                    archivo.driveId
                );

                if (!blob || !blob.size) {
                    throw new Error(
                        "Archivo de imagen vacio"
                    );
                }

                if (!vistaValida(imagen)) return;

                const tipo =
                    (archivo.tipo || "").startsWith("image/")
                        ? archivo.tipo
                        : "image/png";

                const imagenBlob =
                    blob.type.startsWith("image/")
                        ? blob
                        : new Blob([blob], { type: tipo });

                const url = URL.createObjectURL(imagenBlob);

                urlsMiniaturas.push(url);

                imagen.onerror = null;
                imagen.src = url;
                imagen.title = archivo.nombre;

            } catch (error) {

                console.warn(
                    "No se pudo mostrar imagen de Drive:",
                    archivo.nombre,
                    error
                );

                if (vistaValida(imagen)) {

                    imagen.removeAttribute("src");

                    imagen.alt =
                        "Imagen no disponible: " +
                        archivo.nombre;

                    imagen.title =
                        "No se pudo cargar la imagen. " +
                        "Reconecta Google Drive.";
                }
            }
        }

        imagen.onerror = () => {

            imagen.onerror = null;

            void cargarOriginal();
        };

        try {

            const url =
                typeof drive.obtenerMiniatura === "function"
                    ? await drive.obtenerMiniatura(
                        archivo.driveId
                    )
                    : null;

            if (!vistaValida(imagen)) return;

            if (url) {

                imagen.src = url;
                imagen.title = archivo.nombre;

            } else {

                imagen.onerror = null;

                await cargarOriginal();
            }

        } catch (error) {

            console.warn(
                "Miniatura de Drive no disponible:",
                archivo.nombre,
                error
            );

            if (vistaValida(imagen)) {

                imagen.onerror = null;

                await cargarOriginal();
            }
        }
    }

    /* ======================================
       COLA DE MINIATURAS
       MAXIMO 4 CARGAS SIMULTANEAS
    ====================================== */

    function procesarCola() {

        while (
            activas < 4 &&
            pendientes.length > 0
        ) {

            const tarea = pendientes.shift();

            if (!vistaValida(tarea.imagen)) {
                continue;
            }

            activas++;

            cargarArchivoDrive(
                tarea.archivo,
                tarea.imagen
            )
                .catch(error => {
                    console.warn(
                        "Error de miniatura:",
                        error
                    );
                })
                .finally(() => {

                    activas--;

                    if (
                        version === versionMiniaturasDrive
                    ) {
                        procesarCola();
                    }
                });
        }
    }

    /* ======================================
       OBSERVAR MINIATURAS VISIBLES
    ====================================== */

    if ("IntersectionObserver" in window) {

        observadorMiniaturasDrive =
            new IntersectionObserver(entradas => {

                for (const entrada of entradas) {

                    if (!entrada.isIntersecting) {
                        continue;
                    }

                    const imagen = entrada.target;

                    observadorMiniaturasDrive?.unobserve(
                        imagen
                    );

                    const archivo = imagen._archivoDrive;

                    if (
                        archivo &&
                        vistaValida(imagen)
                    ) {

                        pendientes.push({
                            archivo,
                            imagen
                        });
                    }
                }

                procesarCola();

            }, {
                root: null,
                rootMargin: "350px 0px",
                threshold: 0
            });
    }

    /* ======================================
       CREAR TARJETAS DE ARCHIVOS
    ====================================== */

    archivosVisibles.forEach(archivo => {

        const elemento = document.createElement("div");

        elemento.className = "archivo";

        if (seleccionados.has(archivo.id)) {
            elemento.classList.add("seleccionado");
        }

        const tipo = archivo.tipo || "";

        const esVideo = tipo.startsWith("video/");

        const tieneDatosLocales =
            archivo.datos instanceof Blob;

        const tieneDrive =
            typeof archivo.driveId === "string" &&
            archivo.driveId.length > 0;

        let multimedia;

        /* ARCHIVO LOCAL */

        if (tieneDatosLocales) {

            const url = URL.createObjectURL(
                archivo.datos
            );

            urlsMiniaturas.push(url);

            if (esVideo) {

                multimedia = document.createElement(
                    "video"
                );

                multimedia.src = url;
                multimedia.muted = true;
                multimedia.preload = "metadata";
                multimedia.playsInline = true;

            } else {

                multimedia = document.createElement(
                    "img"
                );

                multimedia.src = url;
                multimedia.alt = archivo.nombre;
                multimedia.loading = "lazy";
                multimedia.draggable = false;
            }

        /* ARCHIVO RECUPERADO DE DRIVE */

        } else if (tieneDrive) {

            multimedia = document.createElement(
                "img"
            );

            multimedia.alt = archivo.nombre;
            multimedia.loading = "lazy";
            multimedia.draggable = false;

            multimedia.style.background = "#202020";
            multimedia.style.objectFit = "cover";

            multimedia.title =
                "Esperando miniatura de Google Drive...";

            multimedia._archivoDrive = archivo;

        /* ARCHIVO NO DISPONIBLE */

        } else {

            multimedia = document.createElement(
                "div"
            );

            multimedia.style.cssText =
                "display:flex;align-items:center;" +
                "justify-content:center;" +
                "background:#252525;color:#aaaaaa;" +
                "font-size:12px;text-align:center;" +
                "padding:12px;box-sizing:border-box;" +
                "width:100%;height:100%;";

            multimedia.textContent =
                "Archivo no disponible";
        }

        elemento.appendChild(multimedia);

        elemento.appendChild(
            crearBotonMenu("archivo", archivo)
        );

        const nombreArchivo = document.createElement(
            "div"
        );

        nombreArchivo.className = "archivo-nombre";
        nombreArchivo.textContent = archivo.nombre;
        nombreArchivo.title = archivo.nombre;

        elemento.appendChild(nombreArchivo);

        /* ABRIR O SELECCIONAR */

        elemento.onclick = () => {

            if (seleccionados.size > 0) {

                if (seleccionados.has(archivo.id)) {

                    seleccionados.delete(archivo.id);

                } else {

                    seleccionados.add(archivo.id);
                }

                actualizarSeleccionVisual();

            } else {

                abrirVisor(archivo.id);
            }
        };

        galeria.appendChild(elemento);

        /* OBSERVAR ARCHIVOS DE DRIVE */

        if (
            tieneDrive &&
            !tieneDatosLocales
        ) {

            if (observadorMiniaturasDrive) {

                observadorMiniaturasDrive.observe(
                    multimedia
                );

            } else {

                pendientes.push({
                    archivo,
                    imagen: multimedia
                });
            }
        }
    });

    /* COMPATIBILIDAD SIN INTERSECTIONOBSERVER */

    if (!observadorMiniaturasDrive) {
        procesarCola();
    }
}

/* ==========================================
   SUBIR ARCHIVOS
   INDEXEDDB + GOOGLE DRIVE
========================================== */

async function subirArchivos(evento) {
    const archivos = Array.from(
        evento.target.files || []
    );

    if (archivos.length === 0) return;

    const botonSubir = $("btnSubirArchivos");

    if (botonSubir) {
        botonSubir.disabled = true;
    }

    let guardados = 0;
    let sincronizados = 0;
    let pendientes = 0;
    let incompatibles = 0;

    const errores = [];

    try {
        for (const archivo of archivos) {
            const tipo = archivo.type || "";

            if (
                !tipo.startsWith("image/") &&
                !tipo.startsWith("video/")
            ) {
                incompatibles++;
                continue;
            }

            const nuevoArchivo = {
                id: crearId(),
                nombre: archivo.name,
                tipo: tipo,
                carpeta: carpetaActual,
                fecha: Date.now(),
                datos: archivo,
                driveId: null,
                sincronizacion: "pendiente"
            };

            await guardar("archivos", nuevoArchivo);
            guardados++;

            const drive = window.MiGaleriaGoogleDrive;

            if (!drive || !drive.disponible()) {
                pendientes++;
                continue;
            }

            try {
                drive.actualizarEstado(
                    "Subiendo: " + archivo.name
                );

                const resultado =
                    await drive.subirArchivo(archivo);

                nuevoArchivo.driveId = resultado.id;
                nuevoArchivo.sincronizacion = "sincronizado";

                try {
                    await guardar(
                        "archivos",
                        nuevoArchivo
                    );

                } catch (errorLocal) {
                    console.error(
                        "Subido a Drive, pero fallo " +
                        "guardar su ID local:",
                        resultado.id,
                        errorLocal
                    );

                    errores.push(
                        archivo.name +
                        ": subido a Drive, pero no se " +
                        "pudo registrar su ID local."
                    );

                    pendientes++;
                    continue;
                }

                sincronizados++;

                drive.actualizarEstado(
                    "Google Drive conectado"
                );

            } catch (error) {
                console.error(
                    "Error de Google Drive:",
                    archivo.name,
                    error
                );

                pendientes++;

                errores.push(
                    archivo.name + ": " + error.message
                );

                drive.actualizarEstado(
                    "Hay archivos pendientes de sincronizar"
                );
            }
        }

        await mostrarContenido();

        let mensaje =
            "Resultado de la subida:\n\n" +
            "Guardados localmente: " + guardados + "\n" +
            "Subidos y registrados en Drive: " +
            sincronizados + "\n" +
            "Pendientes o sin confirmar: " +
            pendientes;

        if (incompatibles > 0) {
            mensaje +=
                "\nNo compatibles: " + incompatibles;
        }

        if (errores.length > 0) {
            mensaje +=
                "\n\nDetalles:\n" +
                errores.slice(0, 5).join("\n");
        }

        if (pendientes > 0) {
            mensaje +=
                "\n\nLos archivos locales se conservan." +
                "\nLa sincronizacion pendiente aun " +
                "no se reintenta automaticamente.";
        }

        if (guardados > 0 || incompatibles > 0) {
            alert(mensaje);
        }

    } catch (error) {
        console.error(
            "Error al guardar archivos:",
            error
        );

        mostrarError(error);

    } finally {
        if (evento.target) {
            evento.target.value = "";
        }

        if (botonSubir) {
            botonSubir.disabled = false;
        }
    }
}

/* ==========================================
   MENU DE TRES PUNTOS
   INCLUYE PORTADAS DE CARPETAS
========================================== */

function crearBotonMenu(tipo, objeto) {
    const boton = document.createElement("button");

    boton.className = "boton-menu";
    boton.type = "button";
    boton.textContent = "⋮";
    boton.title = "Opciones";

    boton.onclick = evento => {
        evento.stopPropagation();

        elementoSeleccionado = { tipo, objeto };

        menuContextual
            .querySelectorAll(".opcion-portada-dinamica")
            .forEach(opcion => opcion.remove());

        if (tipo === "carpeta") {
            const crearOpcion = (texto, accion) => {
                const opcion = document.createElement("button");

                opcion.type = "button";
                opcion.className = "opcion-portada-dinamica";
                opcion.textContent = texto;

                opcion.onclick = async e => {
                    e.stopPropagation();
                    cerrarMenu();
                    await accion(objeto);
                };

                menuContextual.appendChild(opcion);
            };

            crearOpcion(
                "🖼 Cambiar portada",
                cambiarPortadaCarpeta
            );

            crearOpcion(
                "✕ Quitar portada",
                quitarPortadaCarpeta
            );
        }

        const opcionSeleccionar = $("opSeleccionar");

        if (opcionSeleccionar) {
            opcionSeleccionar.classList.toggle(
                "oculto",
                tipo !== "archivo"
            );
        }

        const x = Math.min(
            evento.clientX,
            window.innerWidth - 165
        );

        const y = Math.min(
            evento.clientY,
            window.innerHeight -
                (tipo === "carpeta" ? 290 : 190)
        );

        menuContextual.style.left =
            `${Math.max(0, x)}px`;

        menuContextual.style.top =
            `${Math.max(0, y)}px`;

        menuContextual.classList.remove("oculto");
    };

    return boton;
}

/* ==========================================
   CERRAR MENU
========================================== */

function cerrarMenu() {
    menuContextual.classList.add("oculto");
}

/* ==========================================
   SELECCION MULTIPLE
========================================== */

function seleccionarDesdeMenu() {
    if (!elementoSeleccionado) return;

    const { tipo, objeto } = elementoSeleccionado;

    cerrarMenu();

    if (tipo !== "archivo") return;

    if (seleccionados.has(objeto.id)) {
        seleccionados.delete(objeto.id);
    } else {
        seleccionados.add(objeto.id);
    }

    actualizarSeleccionVisual();
}

/* ==========================================
   ACTUALIZAR SELECCION VISUAL
========================================== */

function actualizarSeleccionVisual() {
    document.querySelectorAll(".archivo").forEach(
        (elemento, indice) => {
            const archivo = archivosVisibles[indice];

            if (!archivo) return;

            elemento.classList.toggle(
                "seleccionado",
                seleccionados.has(archivo.id)
            );
        }
    );

    actualizarBarraSeleccion();
}

/* ==========================================
   ACTUALIZAR BARRA DE SELECCION
========================================== */

function actualizarBarraSeleccion() {
    const cantidad = seleccionados.size;

    $("barraSeleccion").classList.toggle(
        "oculto",
        cantidad === 0
    );

    $("contadorSeleccion").textContent =
        `${cantidad} archivo(s) seleccionado(s)`;
}

/* ==========================================
   CANCELAR SELECCION
========================================== */

function cancelarSeleccion() {
    seleccionados.clear();
    actualizarSeleccionVisual();
}

/* ==========================================
   ELEGIR DESTINO
========================================== */

async function elegirDestino(prohibidas = new Set()) {
    const carpetas = await obtenerTodos("carpetas");

    const disponibles = carpetas
        .filter(c => !prohibidas.has(c.id))
        .sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
        );

    let mensaje = "Selecciona el destino:\n\n";
    mensaje += "0 - Inicio\n";

    disponibles.forEach((carpeta, indice) => {
        mensaje +=
            `${indice + 1} - ${carpeta.nombre}\n`;
    });

    const respuesta = prompt(mensaje);

    if (respuesta === null) {
        return { cancelado: true };
    }

    const valor = respuesta.trim();
    const numero = Number(valor);

    if (
        valor === "" ||
        !Number.isInteger(numero) ||
        numero < 0 ||
        numero > disponibles.length
    ) {
        alert("Destino no valido.");
        return { cancelado: true };
    }

    return {
        cancelado: false,
        destino: numero === 0
            ? null
            : disponibles[numero - 1].id
    };
}

/* ==========================================
   RENOMBRAR ELEMENTO
========================================== */

async function renombrarElemento() {
    if (!elementoSeleccionado) return;

    const { tipo, objeto } = elementoSeleccionado;

    cerrarMenu();

    if (tipo === "carpeta") {
        await renombrarCarpeta(objeto);
        return;
    }

    const nombre = prompt(
        "Nuevo nombre del archivo:",
        objeto.nombre
    );

    if (!nombre || !nombre.trim()) return;

    try {
        objeto.nombre = nombre.trim();

        await guardar("archivos", objeto);
        await mostrarContenido();

    } catch (error) {
        mostrarError(error);
    }
}

/* ==========================================
   MOVER UN ELEMENTO
========================================== */

async function moverElemento() {
    if (!elementoSeleccionado) return;

    const { tipo, objeto } = elementoSeleccionado;

    cerrarMenu();

    if (tipo === "carpeta") {
        await moverCarpeta(objeto);
        return;
    }

    try {
        const resultado = await elegirDestino();

        if (resultado.cancelado) return;

        objeto.carpeta = resultado.destino;

        await guardar("archivos", objeto);

        seleccionados.delete(objeto.id);

        await mostrarContenido();

    } catch (error) {
        mostrarError(error);
    }
}

/* ==========================================
   MOVER VARIOS ARCHIVOS
========================================== */

async function moverSeleccionados() {
    if (seleccionados.size === 0) return;

    try {
        const resultado = await elegirDestino();

        if (resultado.cancelado) return;

        const archivos = await obtenerTodos("archivos");
        const ids = new Set(seleccionados);

        await ejecutarTransaccion(
            ["archivos"],
            tx => {
                const store = tx.objectStore("archivos");

                archivos.forEach(archivo => {
                    if (ids.has(archivo.id)) {
                        archivo.carpeta = resultado.destino;
                        store.put(archivo);
                    }
                });
            }
        );

        seleccionados.clear();
        await mostrarContenido();

    } catch (error) {
        mostrarError(error);
    }
}

/* ==========================================
   ELIMINAR UN ELEMENTO
========================================== */

async function eliminarElemento() {
    if (!elementoSeleccionado) return;

    const { tipo, objeto } = elementoSeleccionado;

    cerrarMenu();

    const mensaje = tipo === "carpeta"
        ? `¿Eliminar "${objeto.nombre}" y todo su contenido?`
        : `¿Eliminar "${objeto.nombre}"?`;

    if (!confirm(mensaje)) return;

    try {
        if (tipo === "carpeta") {
            await eliminarCarpetaCompleta(objeto.id);
        } else {
            await eliminar("archivos", objeto.id);
            seleccionados.delete(objeto.id);
        }

        await mostrarContenido();

    } catch (error) {
        mostrarError(error);
    }
}

/* ==========================================
   ELIMINAR VARIOS ARCHIVOS
========================================== */

async function eliminarSeleccionados() {
    if (seleccionados.size === 0) return;

    const cantidad = seleccionados.size;

    if (!confirm(
        `¿Eliminar ${cantidad} archivo(s)?`
    )) {
        return;
    }

    try {
        const ids = new Set(seleccionados);

        await ejecutarTransaccion(
            ["archivos"],
            tx => {
                const store = tx.objectStore("archivos");

                ids.forEach(id => store.delete(id));
            }
        );

        seleccionados.clear();
        await mostrarContenido();

    } catch (error) {
        mostrarError(error);
    }
}

/* ==========================================
   ACTUALIZAR AL CONECTAR GOOGLE DRIVE
========================================== */

window.addEventListener("miGaleriaDriveConectado", () => {

    if (typeof mostrarContenido === "function") {

        mostrarContenido().catch(error =>
            console.error(
                "Error al actualizar miniaturas tras conectar Drive:",
                error
            )
        );
    }
});
