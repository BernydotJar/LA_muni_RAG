# Auditoría de lenguaje y carga cognitiva — superficie pública

Fecha: 2026-08-30
Alcance: frontpage, asistente embebido y rutas públicas principales de LA Muni RAG.

## Marco de revisión

Esta revisión aplica principios de ergonomía cognitiva y psicolingüística útiles para interfaces; no hace afirmaciones clínicas ni pretende medir actividad cerebral.

1. **Fluidez de procesamiento:** preferir palabras comunes y frases que se entiendan en la primera lectura.
2. **Concreto antes que abstracto:** describir la acción observable ("ver la fuente") antes que el concepto técnico ("trazabilidad").
3. **Reconocimiento antes que recuerdo:** las opciones deben explicar qué hacen sin exigir conocer RAG, retrieval, embeddings, backfill o nombres internos.
4. **Una idea principal por bloque:** evitar varias etiquetas que repiten la misma jerarquía dentro de espacios pequeños.
5. **Divulgación progresiva:** respuesta primero; fuentes y detalles técnicos disponibles al pedirlos.
6. **Lenguaje de incertidumbre explícito:** decir qué falta y qué significa, sin eufemismos como "salida segura" o "insuficiencia explícita".
7. **Consistencia léxica:** una misma acción usa la misma palabra en toda la experiencia.
8. **Densidad visual controlada:** reducir píldoras, chips, brillos y paneles anidados que compiten por atención.

## Problemas encontrados

- "Consulta pública. Sin caja negra." depende de una metáfora técnica que no explica el beneficio para la persona.
- "Glass Wall" es un nombre interno sin significado inmediato para la mayoría de usuarios.
- "Trazabilidad", "recuperación", "intake", "pack-aware", "backfill", "workflow", "read-only" y "Antigua-first" aparecen como lenguaje principal en superficies públicas.
- El chat presenta demasiadas capas simultáneas: rail de estado, dos encabezados por respuesta, hallazgos repetidos, resumen de evidencia, chips de fuentes, tarjetas, metadatos, sello y cuatro sugerencias.
- La evidencia se muestra expandida por defecto aunque la tarea primaria es leer la respuesta.
- El tema oscuro del chat rompe continuidad con la frontpage clara y aumenta el peso visual.
- El textarea del chat puede desbordar el grid porque usa `width:100%` con padding sin una regla global `box-sizing:border-box`; varios hijos tampoco declaran `min-width:0`.

## Dirección de copy

- Hero: explicar directamente que se consultan documentos y que cada respuesta permite revisar su fuente.
- Navegación: "Ver cómo funciona" en lugar de "Glass Wall".
- Explicaciones: "fuentes visibles" antes que "trazabilidad".
- Estados: "No encontré información suficiente" antes que "insuficiencia explícita".
- Búsqueda: "Método de búsqueda" antes que "recuperación".
- Chat: una sola jerarquía por respuesta; fuentes colapsadas por defecto y máximo dos preguntas sugeridas.

## Criterios visuales

- Continuidad con el tema heritage-burgundy claro.
- Vidrio sólo como profundidad sutil; no como textura dominante.
- Sin animación orbital continua en el botón del chat.
- Menor radio, sombras más cortas y menos gradientes superpuestos.
- Chat sin overflow horizontal en 320 CSS px ni en viewport móvil dinámico.
- Controles primarios >= 44 CSS px y foco visible.

## Resultado implementado

La revisión se aplicó a la portada, asistente, vista técnica, preparación documental,
guía de procedimientos, academia y superficies locales de casos/comentarios.

Cambios de interacción comprobados:

- el asistente elimina el rail redundante, sellos y capas repetidas;
- la respuesta aparece antes que sus metadatos;
- las fuentes permanecen colapsadas hasta que la persona pulsa `Ver fuentes`;
- las opciones de búsqueda avanzadas están en divulgación progresiva;
- se muestran como máximo dos preguntas relacionadas;
- a 320 CSS px el panel se posiciona respecto del viewport y no produce overflow horizontal;
- la paleta pública revisada ya no contiene los antiguos acentos cian/violeta/rosa neón;
- las animaciones decorativas continuas de la vista técnica y del botón del chat se retiraron.

Evidencia automatizada del árbol final de implementación:

- suite integral: 1,082 tests; 1,080 pass; 0 fail; 2 environment skips;
- Chromium público: 18/18 desktop + mobile;
- el browser gate incluye una consulta real al fallback static-first a 320 CSS px,
  comprueba fuentes colapsadas/expandidas y verifica ausencia de overflow horizontal;
- TypeScript, build backend, snapshot público, artefacto Pages y Graph Harness pasan;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- 0 PDFs crudos detectados en el árbol de trabajo.
