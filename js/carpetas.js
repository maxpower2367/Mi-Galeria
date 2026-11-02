
/* ==========================================
   MI GALERIA - CARPETAS
   Archivo: carpetas.js
========================================== */

/* ==========================================
   CREAR CARPETAS
========================================== */

async function nuevaCarpeta() {

    const nombre = prompt(
        "Nombre de la nueva carpeta:"
    );

    if (!nombre || !nombre.trim()) {
        return;
    }

    try {

        const carpetas = await obtenerTodos("carpetas");

        const repetida = carpetas.some(c =>
            c.padre === carpetaActual &&
            c.nombre.toLowerCase() === nombre.trim().toLowerCase()
        );

        if (repetida) {
            alert("Ya existe una carpeta con ese nombre.");
            return;
        }

        await guardar("carpetas", {

            id: crearId(),

            nombre: nombre.trim(),

            padre: carpetaActual,

            fecha: Date.now()

        });

        await mostrarContenido();

    } catch (error) {

        mostrarError(error);

    }
}


/* ==========================================
   NAVEGAR ENTRE CARPETAS
========================================== */

async function navegar(id) {

    cerrarVisor();
    cerrarMenu();

    carpetaActual = id;

    seleccionados.clear();

    busquedaActual = "";

    $("buscador").value = "";

    await mostrarContenido();
}


/* ==========================================
   MOSTRAR RUTA DE NAVEGACION
========================================== */

function mostrarRuta(carpetas) {

    const ruta = $("ruta");

    ruta.innerHTML = "";

    const inicio = document.createElement("button");

    inicio.textContent = "Inicio";

    inicio.onclick = () => navegar(null);

    ruta.appendChild(inicio);

    let actual = carpetas.find(
        c => c.id === carpetaActual
    );

    const camino = [];

    const visitados = new Set();

    while (actual && !visitados.has(actual.id)) {

        visitados.add(actual.id);

        camino.unshift(actual);

        actual = carpetas.find(
            c => c.id === actual.padre
        );
    }

    camino.forEach(carpeta => {

        const separador = document.createElement("span");

        separador.textContent = "›";

        ruta.appendChild(separador);

        const boton = document.createElement("button");

        boton.textContent = carpeta.nombre;

        boton.onclick = () => navegar(carpeta.id);

        ruta.appendChild(boton);
    });
}


/* ==========================================
   MOSTRAR ARBOL LATERAL
========================================== */

function mostrarArbol(carpetas) {

    const arbol = $("arbolCarpetas");

    arbol.innerHTML = "";

    function agregarNivel(padre, profundidad, visitados) {

        const hijos = carpetas
            .filter(c => c.padre === padre)
            .sort((a, b) =>
                a.nombre.localeCompare(b.nombre)
            );

        hijos.forEach(carpeta => {

            if (visitados.has(carpeta.id)) {
                return;
            }

            const boton = document.createElement("button");

            boton.className = "arbol-item";

            if (carpeta.id === carpetaActual) {
                boton.classList.add("activo");
            }

            boton.style.paddingLeft =
                `${12 + profundidad * 12}px`;

            boton.textContent = "📁 " + carpeta.nombre;

            boton.title = carpeta.nombre;

            boton.onclick = () => navegar(carpeta.id);

            arbol.appendChild(boton);

            const siguientes = new Set(visitados);

            siguientes.add(carpeta.id);

            agregarNivel(
                carpeta.id,
                profundidad + 1,
                siguientes
            );
        });
    }

    agregarNivel(null, 0, new Set());
}


/* ==========================================
   OBTENER PORTADA DE CARPETA
========================================== */

function obtenerPortada(carpetaId, archivos) {

    return archivos
        .filter(archivo =>
            archivo.carpeta === carpetaId &&
            archivo.tipo.startsWith("image/")
        )
        .sort((a, b) =>
            (b.fecha || 0) - (a.fecha || 0)
        )[0] || null;
}


/* ==========================================
   MOSTRAR CARPETAS
========================================== */

function mostrarCarpetas(carpetas, archivos) {

    const contenedor = $("carpetas");

    contenedor.innerHTML = "";

    const hijas = ordenarElementos(

        carpetas.filter(c =>
            c.padre === carpetaActual &&
            coincideBusqueda(c.nombre)
        )
    );

    $("seccionCarpetas").classList.toggle(
        "oculto",
        hijas.length === 0
    );

    hijas.forEach(carpeta => {

        const elemento = document.createElement("div");

        elemento.className = "carpeta";

        const portada = document.createElement("div");

        portada.className = "carpeta-portada";

        const archivoPortada = obtenerPortada(
            carpeta.id,
            archivos
        );

        if (archivoPortada) {

            const img = document.createElement("img");

            const url = URL.createObjectURL(
                archivoPortada.datos
            );

            urlsMiniaturas.push(url);

            img.src = url;

            img.alt = carpeta.nombre;

            img.loading = "lazy";

            portada.appendChild(img);

        } else {

            const icono = document.createElement("span");

            icono.className = "carpeta-icono";

            icono.textContent = "📁";

            portada.appendChild(icono);
        }

        const pie = document.createElement("div");

        pie.className = "carpeta-pie";

        const nombre = document.createElement("span");

        nombre.className = "carpeta-nombre";

        nombre.textContent = carpeta.nombre;

        const menu = crearBotonMenu(
            "carpeta",
            carpeta
        );

        pie.appendChild(nombre);

        pie.appendChild(menu);

        elemento.appendChild(portada);

        elemento.appendChild(pie);

        elemento.onclick = () => navegar(carpeta.id);

        contenedor.appendChild(elemento);
    });
}


/* ==========================================
   OBTENER SUBCARPETAS DESCENDIENTES
========================================== */

function obtenerDescendientes(id, carpetas) {

    const resultado = new Set([id]);

    const pendientes = [id];

    while (pendientes.length > 0) {

        const actual = pendientes.pop();

        carpetas
            .filter(c => c.padre === actual)
            .forEach(c => {

                if (!resultado.has(c.id)) {

                    resultado.add(c.id);

                    pendientes.push(c.id);
                }
            });
    }

    return resultado;
}


/* ==========================================
   COMPROBAR NOMBRE DE CARPETA
========================================== */

async function nombreCarpetaDisponible(
    nombre,
    padre,
    ignorarId = null
) {

    const carpetas = await obtenerTodos("carpetas");

    return !carpetas.some(c =>
        c.id !== ignorarId &&
        c.padre === padre &&
        c.nombre.toLowerCase() === nombre.toLowerCase()
    );
}


/* ==========================================
   RENOMBRAR CARPETA
========================================== */

async function renombrarCarpeta(carpeta) {

    const nombre = prompt(
        "Nuevo nombre de la carpeta:",
        carpeta.nombre
    );

    if (!nombre || !nombre.trim()) {
        return;
    }

    const nuevoNombre = nombre.trim();

    try {

        const disponible = await nombreCarpetaDisponible(
            nuevoNombre,
            carpeta.padre,
            carpeta.id
        );

        if (!disponible) {
            alert("Ya existe una carpeta con ese nombre.");
            return;
        }

        carpeta.nombre = nuevoNombre;

        await guardar("carpetas", carpeta);

        await mostrarContenido();

    } catch (error) {

        mostrarError(error);
    }
}


/* ==========================================
   MOVER CARPETA
========================================== */

async function moverCarpeta(carpeta) {

    try {

        const carpetas = await obtenerTodos("carpetas");

        const prohibidas = obtenerDescendientes(
            carpeta.id,
            carpetas
        );

        const resultado = await elegirDestino(prohibidas);

        if (resultado.cancelado) {
            return;
        }

        const disponible = await nombreCarpetaDisponible(
            carpeta.nombre,
            resultado.destino,
            carpeta.id
        );

        if (!disponible) {
            alert(
                "Ya existe una carpeta con ese nombre en el destino."
            );
            return;
        }

        carpeta.padre = resultado.destino;

        await guardar("carpetas", carpeta);

        await mostrarContenido();

    } catch (error) {

        mostrarError(error);
    }
}


/* ==========================================
   ELIMINAR CARPETA Y SU CONTENIDO
========================================== */

async function eliminarCarpetaCompleta(id) {

    const carpetas = await obtenerTodos("carpetas");

    const archivos = await obtenerTodos("archivos");

    const ids = obtenerDescendientes(id, carpetas);

    await ejecutarTransaccion(
        ["carpetas", "archivos"],
        tx => {

            const storeCarpetas = tx.objectStore("carpetas");

            const storeArchivos = tx.objectStore("archivos");

            archivos.forEach(archivo => {

                if (ids.has(archivo.carpeta)) {
                    storeArchivos.delete(archivo.id);
                }
            });

            ids.forEach(carpetaId => {
                storeCarpetas.delete(carpetaId);
            });
        }
    );
}
