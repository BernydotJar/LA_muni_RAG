# LA Muni RAG — Guion de demo municipal

## Objetivo de la demo

Presentar LA Muni RAG como un asistente documental municipal para consultar documentos oficiales en español con evidencia visible, citas y trazabilidad.

Duración sugerida: 7 a 10 minutos.

## Mensaje inicial

> Este sistema ayuda a consultar documentos municipales extensos sin perder trazabilidad. La respuesta no se presenta como verdad aislada: siempre debe estar vinculada a evidencia verificable del corpus documental.

## Secuencia recomendada

### 1. Contexto institucional

Abrir la página principal y explicar:

- El producto está orientado a consulta pública/documental municipal.
- La experiencia está localizada para La Antigua Guatemala.
- El valor principal es reducir fricción de búsqueda en documentos extensos.

Frase sugerida:

> La meta no es reemplazar el criterio técnico o legal, sino hacer que la evidencia documental sea más accesible, verificable y reutilizable.

### 2. Consulta amplia

Abrir el widget y preguntar:

```text
necesidades más urgentes
```

Qué mostrar:

- Respuesta breve.
- Hallazgos principales.
- Fuentes verificadas visibles.
- Estado de evidencia.
- Trazabilidad.

Frase sugerida:

> En una pregunta amplia, el sistema no fuerza una respuesta única. Resume lo que encuentra y permite revisar las fuentes que sostienen la lectura.

### 3. Consulta temática

Preguntar:

```text
agua
```

Qué mostrar:

- Referencias sobre agua potable, saneamiento, aguas residuales o acueductos si existen en el corpus.
- Fragmentos documentales.
- Páginas de origen.

Frase sugerida:

> Para temas específicos, el sistema ayuda a ubicar rápidamente dónde aparece el asunto dentro del documento municipal.

### 4. Evidencia y límites

Mostrar el bloque de fuentes.

Explicar:

- Las fuentes se ven por defecto.
- La evidencia se puede ocultar solo para compactar lectura.
- Las citas se pueden expandir.
- Si la cobertura es limitada, se indica de forma explícita.

Frase sugerida:

> La evidencia no está escondida. Está visible para que cualquier usuario pueda revisar por qué el sistema respondió así.

### 5. Glass Wall

Abrir `/glass-wall.html` y ejecutar una consulta.

Qué mostrar:

- Ruta de consulta.
- Búsqueda exacta, léxica y vectorial.
- Evidencia encontrada.
- Estado del sistema.
- Panel vector/embedding.

Frase sugerida:

> Esta vista permite explicar cómo se llegó a la respuesta sin mostrar información sensible ni detalles internos que no corresponden a una interfaz pública.

## Preguntas sugeridas para demo

- ¿Cuáles son las necesidades más urgentes?
- ¿Qué dice el PDM-OT sobre agua?
- ¿Qué menciona sobre uso de suelo?
- ¿Qué evidencia existe sobre participación ciudadana?
- ¿Qué documentos hablan sobre saneamiento?

## Preguntas difíciles y respuestas recomendadas

### ¿El sistema toma decisiones?

No. El sistema consulta documentos y presenta evidencia. La decisión sigue siendo humana, técnica, legal o política según corresponda.

### ¿Puede equivocarse?

Puede tener cobertura limitada o interpretar una consulta amplia de forma incompleta. Por eso muestra fuentes, estado de evidencia y trazabilidad.

### ¿Qué pasa si no hay evidencia?

Debe indicarlo claramente. Una respuesta sin evidencia suficiente no debe presentarse como conclusión.

### ¿Esto reemplaza al personal municipal?

No. Reduce tiempo de búsqueda y mejora acceso a información documental, pero no reemplaza revisión experta.

### ¿La ciudadanía podría usarlo?

Sí, si el corpus y las reglas de publicación están aprobados. La experiencia está pensada para consulta clara, no para exponer información operativa sensible.

## Cierre recomendado

> Este asistente no promete automatizar la municipalidad. Promete algo más concreto: hacer que los documentos municipales sean consultables, citables y auditables para mejores conversaciones públicas y técnicas.
