/* ==========================================
   MI GALERIA - MENU ORGANIZADO
   Archivo: js/menu.js
   Conserva los botones originales y sus eventos.
========================================== */
(() => {
    "use strict";

    const boton = document.getElementById("btnMenuAjustes");
    const panel = document.getElementById("panelMenuAjustes");
    if (!boton || !panel) return;

    const estilo = document.createElement("style");
    estilo.textContent = `
        #panelMenuAjustes.menu-organizado {
            width: 305px; max-width: calc(100vw - 24px);
            max-height: min(75vh, 620px); overflow-y: auto;
            padding: 10px; box-sizing: border-box;
        }
        #panelMenuAjustes.menu-organizado > :not(#menuNuevo) {
            display: none !important;
        }
        #menuNuevo { display: block; font-family: inherit; }
        #menuNuevo .mn-cabecera {
            display: flex; justify-content: space-between; align-items: center;
            padding: 9px 10px 12px; font-size: 15px; font-weight: 700;
        }
        #menuNuevo .mn-etiqueta {
            padding: 12px 10px 5px; color: #999; font-size: 10px;
            font-weight: 700; letter-spacing: 1px;
        }
        #menuNuevo .mn-accion {
            display: flex; align-items: center; gap: 11px; width: 100%;
            padding: 11px 10px; margin: 1px 0; border-radius: 9px;
            text-align: left; font-size: 13px; color: #eee;
            background: transparent; border: 0; cursor: pointer;
        }
        #menuNuevo .mn-accion:hover { background: #303035; }
        #menuNuevo .mn-icono { width: 22px; text-align: center; font-size: 17px; flex-shrink: 0; }
        #menuNuevo .mn-texto { flex: 1; min-width: 0; }
        #menuNuevo .mn-subtexto { display: block; margin-top: 3px; color: #999; font-size: 11px; }
        #menuNuevo .mn-linea { height: 1px; margin: 8px 4px; background: #36363a; }
        #menuNuevo .mn-estado { font-size: 11px; color: #aab0ba; padding: 4px 10px 9px; }
        #menuNuevo .mn-estado.conectado { color: #80d7a1; }
        #menuNuevo .mn-oculto { display: none !important; }
        #menuNuevo .mn-volver { color: #9fc0ff !important; }
    `;
    document.head.appendChild(estilo);

    const interfaz = document.createElement("div");
    interfaz.id = "menuNuevo";
    panel.appendChild(interfaz);
    panel.classList.add("menu-organizado");

    let vista = "principal";

    function conectado() {
        try {
            return Boolean(window.MiGaleriaGoogleDrive?.disponible?.());
        } catch (_) {
            return false;
        }
    }

    function abrirMenu(abierto) {
        panel.hidden = !abierto;
        boton.setAttribute("aria-expanded", String(abierto));
        boton.textContent = abierto ? "✕" : "☰";
        if (abierto) {
            vista = "principal";
            dibujar();
        }
    }

    function ejecutar(ids, textos = []) {
        let original = null;
        for (const id of ids) {
            original = document.getElementById(id);
            if (original) break;
        }
        if (!original && textos.length) {
            const candidatos = [...panel.querySelectorAll("button")]
                .filter(el => !interfaz.contains(el));
            original = candidatos.find(el => textos.some(t =>
                (el.textContent || "").toLowerCase().includes(t.toLowerCase())
            ));
        }
        if (!original) {
            alert("Esta funcion todavia no esta disponible en esta version.");
            return;
        }
        if (original.disabled) {
            alert("Conecta Google Drive antes de utilizar esta opcion.");
            return;
        }
        abrirMenu(false);
        original.click();
    }

    function accion(icono, titulo, subtitulo, callback) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mn-accion";
        const i = document.createElement("span");
        i.className = "mn-icono";
        i.textContent = icono;
        const t = document.createElement("span");
        t.className = "mn-texto";
        t.textContent = titulo;
        if (subtitulo) {
            const s = document.createElement("span");
            s.className = "mn-subtexto";
            s.textContent = subtitulo;
            t.appendChild(s);
        }
        b.append(i, t);
        b.addEventListener("click", e => {
            e.stopPropagation();
            callback();
        });
        interfaz.appendChild(b);
        return b;
    }

    function etiqueta(texto) {
        const d = document.createElement("div");
        d.className = "mn-etiqueta";
        d.textContent = texto;
        interfaz.appendChild(d);
    }

    function linea() {
        const d = document.createElement("div");
        d.className = "mn-linea";
        interfaz.appendChild(d);
    }

    function dibujar() {
        interfaz.replaceChildren();
        const h = document.createElement("div");
        h.className = "mn-cabecera";
        h.textContent = vista === "principal" ? "Opciones" : "Google Drive";
        interfaz.appendChild(h);

        if (vista === "principal") {
            accion("☁", "Google Drive", conectado() ? "Conectado · Administrar cuenta" : "Desconectado · Conectar cuenta", () => {
                vista = "drive";
                dibujar();
            });
            linea();
            etiqueta("RESPALDOS EN LA NUBE");
            accion("↑", "Guardar estructura", "Carpetas, archivos y portadas", () =>
                ejecutar(["btnGuardarMetadatosDrive"]));
            accion("↓", "Recuperar galeria", "Restaurar desde Google Drive", () =>
                ejecutar(["btnRecuperarDrive"], ["recuperar galeria desde google drive"]));
            accion("↻", "Subir archivos pendientes", "Sincronizar archivos locales", () =>
                ejecutar(["btnSubirPendientesDrive", "btnSubirPendientesGoogleDrive"], ["subir pendientes a google drive"]));
            linea();
            etiqueta("RESPALDO LOCAL");
            accion("⇩", "Exportar respaldo", "Guardar una copia en tu equipo", () =>
                ejecutar(["btnExportarRespaldo"]));
            accion("▣", "Importar respaldo", "Abrir una copia local", () =>
                ejecutar(["btnImportarRespaldo"]));
        } else {
            const volver = accion("‹", "Volver al menu", "", () => {
                vista = "principal";
                dibujar();
            });
            volver.classList.add("mn-volver");
            linea();
            const estado = document.createElement("div");
            estado.className = "mn-estado" + (conectado() ? " conectado" : "");
            estado.textContent = conectado() ? "● Google Drive conectado" : "○ Google Drive desconectado";
            interfaz.appendChild(estado);
            const detalle = document.createElement("div");
            detalle.className = "mn-estado";
            detalle.textContent = "Consultando archivos locales...";
            interfaz.appendChild(detalle);
            // Leer los contadores directamente de IndexedDB al abrir esta vista.
            // No altera los archivos ni solicita descargas a Google Drive.
            if (typeof obtenerTodos === "function") {
                obtenerTodos("archivos").then(archivos => {
                    if (vista !== "drive" || !detalle.isConnected) return;
                    const total = archivos.length;
                    const conDrive = archivos.filter(a =>
                        typeof a.driveId === "string" && a.driveId.trim() !== ""
                    ).length;
                    detalle.textContent = `Con copia registrada: ${conDrive} / ${total} · Pendientes: ${total - conDrive}`;
                }).catch(error => {
                    console.error("No se pudo consultar la sincronizacion:", error);
                    if (detalle.isConnected) detalle.textContent = "No se pudo consultar el resumen local.";
                });
            } else {
                detalle.textContent = "Resumen no disponible.";
            }
            accion("☁", conectado() ? "Reconectar Google Drive" : "Conectar Google Drive", "Actualizar acceso a tu cuenta", () =>
                ejecutar(["btnConectarGoogleDrive"]));
            linea();
            etiqueta("HERRAMIENTAS ADICIONALES");
            accion("↧", "Recuperar estructura", "Restaurar carpetas y referencias", () =>
                ejecutar(["btnRecuperarEstructuraDrive"], ["recuperar estructura de google drive"]));
            accion("↧", "Recuperacion alternativa", "Usar el otro metodo de recuperacion", () =>
                ejecutar(["btnRecuperarGoogleDrive"], ["recuperar desde google drive"]));
            linea();
            etiqueta("DIAGNOSTICO");
            accion("☷", "Consultar archivos en Drive", "Ver archivos disponibles", () =>
                ejecutar(["btnListarGoogleDrive"]));
            accion("✓", "Subir archivo de prueba", "Comprobar la conexion", () =>
                ejecutar(["btnPruebaGoogleDrive"]));
        }
    }

    boton.addEventListener("click", evento => {
        evento.stopPropagation();
        abrirMenu(panel.hidden);
    });

    document.addEventListener("click", evento => {
        if (!panel.hidden && !boton.contains(evento.target) && !panel.contains(evento.target)) {
            abrirMenu(false);
        }
    });
    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") abrirMenu(false);
    });
    dibujar();
})();
