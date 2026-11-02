
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

    return nombre.toLowerCase().includes(busquedaActual);
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
========================================== */

function mostrarArchivos(archivos) {

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

    archivosVisibles.forEach(archivo => {

        /* ==================================
           CONTENEDOR DEL ARCHIVO
        ================================== */

        const elemento = document.createElement("div");

        elemento.className = "archivo";

        if (seleccionados.has(archivo.id)) {
            elemento.classList.add("seleccionado");
        }


        /* ==================================
           CREAR URL DE MINIATURA
        ================================== */

        const url = URL.createObjectURL(archivo.datos);

        urlsMiniaturas.push(url);


        /* ==================================
           CREAR IMAGEN O VIDEO
        ================================== */

        let multimedia;

        if (archivo.tipo.startsWith("video/")) {

            multimedia = document.createElement("video");

            multimedia.src = url;
            multimedia.muted = true;
            multimedia.preload = "metadata";
            multimedia.playsInline = true;

        } else {

            multimedia = document.createElement("img");

            multimedia.src = url;
            multimedia.alt = archivo.nombre;
            multimedia.loading = "lazy";
            multimedia.draggable = false;
        }

        elemento.appendChild(multimedia);


        /* ==================================
           BOTON DE TRES PUNTOS
        ================================== */

        elemento.appendChild(
            crearBotonMenu("archivo", archivo)
        );


        /* ==================================
           NOMBRE DEL ARCHIVO
        ================================== */

        const nombreArchivo = document.createElement("div");

        nombreArchivo.className = "archivo-nombre";

        nombreArchivo.textContent = archivo.nombre;

        nombreArchivo.title = archivo.nombre;

        elemento.appendChild(nombreArchivo);


        /* ==================================
           ABRIR VISOR O SELECCIONAR
        ================================== */

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


        /* ==================================
           AGREGAR ARCHIVO A LA GALERIA
        ================================== */

        galeria.appendChild(elemento);
    });
}


/* ==========================================
   SUBIR ARCHIVOS
========================================== */

async function subirArchivos(evento) {

    const archivos = Array.from(evento.target.files);

    if (archivos.length === 0) return;

    try {

        for (const archivo of archivos) {

            if (
                !archivo.type.startsWith("image/") &&
                !archivo.type.startsWith("video/")
            ) {
                continue;
            }

            await guardar("archivos", {

                id: crearId(),
                nombre: archivo.name,
                tipo: archivo.type,
                carpeta: carpetaActual,
                fecha: Date.now(),
                datos: archivo
            });
        }

        await mostrarContenido();

    } catch (error) {

        mostrarError(error);

    } finally {

        evento.target.value = "";
    }
}


/* ==========================================
   MENU DE TRES PUNTOS
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

        const opcionSeleccionar = $("opSeleccionar");

        opcionSeleccionar.classList.toggle(
            "oculto",
            tipo !== "archivo"
        );

        const x = Math.min(
            evento.clientX,
            window.innerWidth - 165
        );

        const y = Math.min(
            evento.clientY,
            window.innerHeight - 190
        );

        menuContextual.style.left = `${Math.max(0, x)}px`;
        menuContextual.style.top = `${Math.max(0, y)}px`;

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
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    let mensaje = "Selecciona el destino:\n\n";

    mensaje += "0 - Inicio\n";

    disponibles.forEach((carpeta, indice) => {

        mensaje += `${indice + 1} - ${carpeta.nombre}\n`;
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

        alert("Destino no válido.");

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

    if (!confirm(`¿Eliminar ${cantidad} archivo(s)?`)) {

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
