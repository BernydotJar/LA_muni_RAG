import type { DomainWorkflowTemplate, DomainWorkflowTemplateStep } from "../types.js";

export const WATER_PENDING_SOURCE = "Cobertura documental pendiente para este tenant.";

type WaterCategoryTuple = readonly [title: string, focus: string, patterns: string];

const WATER_CATEGORY_DATA = [
  ["Necesidad comunitaria", "la necesidad, población afectada, cobertura actual y problema a resolver", "necesidad comunitaria|diagnóstico comunitario|cobertura de agua|carencia de agua"],
  ["Solicitud", "la existencia, identidad, fecha, alcance y recepción de una solicitud verificable", "solicitud de agua|solicitud comunitaria|petición de agua|ingreso de solicitud"],
  ["COCODE", "la participación documentada del COCODE y el alcance de cualquier gestión atribuida a ese órgano", "cocode|consejo comunitario de desarrollo|acta cocode"],
  ["COMUDE", "la participación documentada del COMUDE y la eventual priorización que corresponda", "comude|consejo municipal de desarrollo|acta comude|priorización comude"],
  ["Planificación municipal", "la ruta de planificación municipal aplicable y el instrumento que deba registrar la iniciativa", "planificación municipal|dirección municipal de planificación|dmp|plan municipal"],
  ["Perfil", "la necesidad de un perfil de proyecto y el contenido mínimo exigido por una fuente aplicable", "perfil del proyecto|perfil de proyecto|ficha de proyecto"],
  ["Diagnóstico", "el diagnóstico técnico, social o territorial requerido para definir el problema y sus alternativas", "diagnóstico|línea base|situación actual"],
  ["Fuente de agua", "la fuente propuesta, ubicación, tipo, titularidad y condiciones de aprovechamiento", "fuente de agua|nacimiento|pozo|captación"],
  ["Disponibilidad", "la disponibilidad hídrica y el caudal verificable en condiciones relevantes", "disponibilidad hídrica|aforo|caudal disponible|caudal de la fuente"],
  ["Calidad", "la calidad y potabilidad mediante análisis y criterios de fuentes competentes", "calidad del agua|potabilidad|análisis bacteriológico|análisis fisicoquímico"],
  ["Terreno", "los terrenos necesarios para captación, conducción, almacenamiento, tratamiento u otras obras", "terreno para|predio|ubicación del terreno|sitio de obra"],
  ["Propiedad", "la propiedad, posesión o título habilitante de cada inmueble relevante", "propiedad del terreno|título de propiedad|registro de la propiedad|certificación registral"],
  ["Servidumbres", "las servidumbres necesarias, su constitución, alcance, titulares y respaldo", "servidumbre|servidumbre de acueducto|gravamen"],
  ["Derechos de paso", "los derechos de paso requeridos para tuberías, accesos, inspección, operación o mantenimiento", "derecho de paso|derechos de paso|paso de tubería|permiso de paso"],
  ["Topografía", "el levantamiento topográfico y los datos altimétricos o planimétricos exigidos", "topografía|levantamiento topográfico|curvas de nivel"],
  ["Estudio hidráulico", "el estudio hidráulico, diseño de red, presiones, caudales y criterios técnicos", "estudio hidráulico|diseño hidráulico|modelación hidráulica"],
  ["Demanda", "la demanda actual y proyectada, población de diseño, dotación y horizonte", "demanda de agua|población de diseño|dotación|proyección de demanda"],
  ["PDM-OT", "la alineación documentada con el PDM-OT vigente y las limitaciones territoriales", "pdm-ot|plan de desarrollo municipal y ordenamiento territorial|ordenamiento territorial"],
  ["POM", "la incorporación o correspondencia con el Plan Operativo Multianual cuando aplique", "plan operativo multianual|pom|programación multianual"],
  ["POA", "la incorporación o correspondencia con el Plan Operativo Anual cuando aplique", "plan operativo anual|poa|programación anual"],
  ["Costo", "el costo estimado, componentes, supuestos, actualización y respaldo técnico", "costo estimado|presupuesto del proyecto|presupuesto de obra|costos unitarios"],
  ["Financiamiento", "las fuentes de financiamiento posibles y sus condiciones documentales", "financiamiento|fuente de financiamiento|aporte municipal|aporte comunitario|cofinanciamiento"],
  ["Inversión pública", "los requisitos de inversión pública y la evidencia de registro o evaluación", "inversión pública|proyecto de inversión|segeplan"],
  ["Sistema nacional aplicable", "qué sistema nacional vigente resulta aplicable, si alguno, sin asumir nombre o trámite", "sistema nacional de inversión pública|snip|sistema nacional vigente|registro de proyecto"],
  ["Ambiente", "los instrumentos, licencias, evaluaciones, permisos o medidas ambientales exigidos", "instrumento ambiental|licencia ambiental|evaluación ambiental|marn|impacto ambiental"],
  ["Salud", "los requisitos, dictámenes, controles o autorizaciones sanitarias vinculados al agua potable", "salud pública|autorización sanitaria|mspas|vigilancia de agua"],
  ["Dictámenes", "los dictámenes técnicos, jurídicos, financieros, ambientales o sanitarios realmente exigidos", "dictamen técnico|dictamen jurídico|dictamen financiero|dictámenes"],
  ["Concejo", "las decisiones, conocimiento o aprobaciones del Concejo Municipal que una fuente exija", "concejo municipal|punto de concejo|acta de concejo|certificación del punto"],
  ["Expediente", "la integración, foliado, trazabilidad, custodia y completitud del expediente", "expediente del proyecto|expediente administrativo|integración del expediente|foliado"],
  ["Contratación", "la modalidad y ruta aplicable según objeto, monto, fondos y normativa vigente", "contratación|modalidad de contratación|guatecompras|ley de contrataciones"],
  ["Ofertas", "la recepción, integridad, evaluación y trazabilidad de ofertas cuando se requieran", "ofertas|recepción de ofertas|evaluación de ofertas|plica"],
  ["Adjudicación", "la decisión de adjudicación, fundamentos, notificación y controles", "adjudicación|acta de adjudicación|resolución de adjudicación"],
  ["Contrato", "la formalización, garantías, obligaciones, alcance, precio y plazo documentados", "contrato de obra|contrato administrativo|garantía de cumplimiento|formalización del contrato"],
  ["Inicio", "las condiciones documentales para iniciar, incluida orden, acta, sitio o requisito previo", "orden de inicio|acta de inicio|inicio de obra|entrega del sitio|entrega de terreno"],
  ["Ejecución", "la ejecución física y documental conforme al alcance validado, sin asumir avance", "ejecución de obra|avance físico|programa de ejecución"],
  ["Supervisión", "la supervisión técnica, administrativa, financiera y de calidad que corresponda", "supervisión de obra|informe de supervisión|supervisor"],
  ["Bitácora", "la bitácora aplicable, responsables, contenido, integridad y eventos registrados", "bitácora|libro de bitácora|anotación de obra"],
  ["Estimaciones", "las estimaciones, mediciones, soporte, revisión y aprobación documentada", "estimación de obra|estimaciones|medición de obra"],
  ["Cambios", "los cambios de alcance, cantidades, diseño, costo o plazo y la autoridad para aprobarlos", "orden de cambio|trabajo extra|cambio de alcance|modificación contractual|variación de cantidades"],
  ["Recepción", "la recepción provisional o definitiva, inspecciones, actas, reservas y correcciones", "recepción de obra|acta de recepción|recepción definitiva"],
  ["Liquidación", "la liquidación técnica, administrativa y contractual y sus requisitos", "liquidación del contrato|liquidación de obra|finiquito"],
  ["Pagos", "los pagos, retenciones, garantías, saldos y soportes sin asumir montos", "pago de estimación|pagos del contrato|retención|saldo contractual"],
  ["Operación", "el modelo de operación, responsables, recursos, protocolos y transferencia", "operación del sistema|puesta en operación|operador del sistema"],
  ["Mantenimiento", "el mantenimiento preventivo y correctivo, responsables, presupuesto, repuestos y registros", "mantenimiento del sistema|mantenimiento preventivo|mantenimiento correctivo|plan de mantenimiento"],
  ["Cierre", "el cierre técnico, administrativo, financiero y documental del proyecto", "cierre del proyecto|cierre administrativo|cierre financiero|expediente de cierre"],
  ["Continuidad", "las condiciones para continuidad, contingencias, resiliencia y sostenibilidad", "continuidad del abastecimiento|continuidad del servicio|plan de contingencia|sostenibilidad del sistema|resiliencia"],
  ["Calidad del servicio", "los indicadores, controles, frecuencia y evidencia de la calidad del servicio", "calidad del servicio|indicadores del servicio|presión de servicio|horas de servicio|nivel de servicio"],
] as const satisfies readonly WaterCategoryTuple[];

const WATER_REQUIRED_EVIDENCE = {
  "Necesidad comunitaria": [
    "Diagnóstico comunitario con población afectada, cobertura actual y problema de abastecimiento",
    "Acta, solicitud o registro municipal que identifique la necesidad"
  ],
  "Solicitud": [
    "Solicitud firmada con objeto, comunidad, fecha y persona u órgano solicitante",
    "Constancia municipal de recepción, número de ingreso o incorporación al expediente"
  ],
  "COCODE": [
    "Acta o certificación del COCODE que documente representación, solicitud o priorización",
    "Constancia de integración y competencia del COCODE aplicable al caso"
  ],
  "COMUDE": [
    "Acta o certificación del COMUDE que documente conocimiento o priorización",
    "Registro del punto de agenda, decisión y participantes aplicable al proyecto"
  ],
  "Planificación municipal": [
    "Manual o procedimiento vigente de la Dirección Municipal de Planificación",
    "Registro municipal que muestre recepción, evaluación o programación de la iniciativa"
  ],
  "Perfil": [
    "Norma SNIP vigente que determine perfil, prefactibilidad o factibilidad según complejidad",
    "Perfil o estudio de preinversión firmado y versionado para el proyecto"
  ],
  "Diagnóstico": [
    "Diagnóstico técnico, social y territorial firmado, con línea base y alternativas",
    "Datos de campo y fuentes que permitan reproducir el diagnóstico"
  ],
  "Fuente de agua": [
    "Ficha de identificación de la fuente con ubicación, tipo, titularidad y condiciones de aprovechamiento",
    "Inspección o estudio técnico que vincule la fuente con el proyecto"
  ],
  "Disponibilidad": [
    "Aforos o estudio hidrológico con fechas, método y condiciones estacionales",
    "Cálculo firmado de caudal disponible frente a demanda y restricciones"
  ],
  "Calidad": [
    "Certificado o dictamen sanitario aplicable emitido por la autoridad de salud competente",
    "Resultados de laboratorio físicos, químicos y microbiológicos trazables a la fuente"
  ],
  "Terreno": [
    "Planos y levantamiento que identifiquen los predios requeridos por cada componente",
    "Inspección o informe técnico que confirme aptitud y disponibilidad física del sitio"
  ],
  "Propiedad": [
    "Certificación registral, escritura o título habilitante vigente de cada inmueble",
    "Dictamen jurídico sobre titularidad, gravámenes y facultad de uso para el proyecto"
  ],
  "Servidumbres": [
    "Escritura, convenio o resolución que constituya cada servidumbre necesaria",
    "Plano y certificación registral que definan trazado, alcance, titulares y gravámenes"
  ],
  "Derechos de paso": [
    "Permisos o convenios firmados para tuberías, accesos, inspección y mantenimiento",
    "Plano de trazado y registro de propietarios afectados"
  ],
  "Topografía": [
    "Levantamiento topográfico firmado con coordenadas, datum, perfiles y curvas de nivel",
    "Archivos y memoria técnica que permitan verificar el levantamiento"
  ],
  "Estudio hidráulico": [
    "Memoria de cálculo hidráulico firmada con caudales, presiones, diámetros y escenarios",
    "Planos de diseño y criterios técnicos versionados"
  ],
  "Demanda": [
    "Proyección de población y demanda con horizonte, dotación, pérdidas y supuestos",
    "Fuente oficial de población y memoria de cálculo firmada"
  ],
  "PDM-OT": [
    "PDM-OT vigente y sección citable relacionada con el territorio o servicio",
    "Matriz o dictamen municipal de alineación del proyecto con el PDM-OT"
  ],
  "POM": [
    "Plan Operativo Multianual vigente o certificación de la programación aplicable",
    "Registro que vincule el proyecto, producto, meta, período y financiamiento"
  ],
  "POA": [
    "Plan Operativo Anual vigente o certificación de incorporación aplicable",
    "Registro que vincule el proyecto con actividad, meta, presupuesto y ejercicio fiscal"
  ],
  "Costo": [
    "Presupuesto firmado con cantidades, precios unitarios, componentes y fecha base",
    "Memoria de costos, cotizaciones o referencia oficial que sustente los valores"
  ],
  "Financiamiento": [
    "Certificación presupuestaria, convenio o resolución que identifique fuente y monto",
    "Condiciones documentadas de cofinanciamiento, desembolso y contrapartidas"
  ],
  "Inversión pública": [
    "Normas SNIP vigentes y anexos aplicables al tipo y fase del proyecto",
    "Constancia de registro, evaluación o dictamen del proyecto en el sistema aplicable"
  ],
  "Sistema nacional aplicable": [
    "Catálogo oficial vigente que identifique el sistema, normas y ejercicio fiscal",
    "Código o constancia del proyecto que permita verificar su estado en ese sistema"
  ],
  "Ambiente": [
    "Clasificación documentada con el Listado Taxativo vigente y características del proyecto",
    "Instrumento, resolución o licencia correspondiente a la categoría efectivamente determinada"
  ],
  "Salud": [
    "Norma o trámite sanitario vigente aplicable al proyecto de abastecimiento",
    "Certificado, dictamen, inspección o autorización emitida para el proyecto y fuente concretos"
  ],
  "Dictámenes": [
    "Relación de dictámenes exigidos por norma o procedimiento aplicable",
    "Dictámenes técnicos, jurídicos, financieros, ambientales o sanitarios firmados para el expediente"
  ],
  "Concejo": [
    "Certificación del punto de acta del Concejo Municipal aplicable",
    "Expediente que muestre propuesta, decisión, condiciones y autoridad competente"
  ],
  "Expediente": [
    "Índice, foliado y control de versiones del expediente administrativo",
    "Constancia de custodia y lista de documentos completos, pendientes o reservados"
  ],
  "Contratación": [
    "Ley, reglamento y normas GUATECOMPRAS vigentes aplicables al objeto y monto",
    "Justificación firmada de modalidad, unidad compradora, disponibilidad y expediente"
  ],
  "Ofertas": [
    "Evento y publicaciones verificables en GUATECOMPRAS cuando corresponda",
    "Acta de recepción, ofertas íntegras y evaluación firmada con criterios aplicados"
  ],
  "Adjudicación": [
    "Acta o resolución de adjudicación con fundamentos y autoridad competente",
    "Notificaciones, publicaciones y constancias de firmeza o recursos"
  ],
  "Contrato": [
    "Contrato firmado, aprobación cuando aplique y alcance, precio y plazo versionados",
    "Garantías, publicaciones y documentos de formalización exigidos"
  ],
  "Inicio": [
    "Orden o acta de inicio firmada y fecha efectiva",
    "Entrega de sitio y constancias de garantías, permisos y demás condiciones previas"
  ],
  "Ejecución": [
    "Programa de trabajo aprobado y reportes de avance físico-financiero",
    "Evidencia de campo y entregables vinculados al alcance contractual"
  ],
  "Supervisión": [
    "Nombramiento o contrato del responsable de supervisión",
    "Informes firmados de control técnico, administrativo, financiero y de calidad"
  ],
  "Bitácora": [
    "Bitácora autorizada y trazable al contrato u obra",
    "Asientos firmados sobre instrucciones, eventos, avances, incidencias y respuestas"
  ],
  "Estimaciones": [
    "Estimaciones y mediciones firmadas con períodos, cantidades y precios",
    "Revisión, aprobación, soportes de campo y vínculo con pagos"
  ],
  "Cambios": [
    "Orden de cambio o expediente técnico que justifique alcance, cantidades, costo o plazo",
    "Aprobaciones jurídica, técnica, presupuestaria y contractual exigidas"
  ],
  "Recepción": [
    "Acta de recepción provisional o definitiva firmada por la comisión competente",
    "Inspección, lista de pendientes, correcciones y constancia de aceptación"
  ],
  "Liquidación": [
    "Informe y acta de liquidación técnica, administrativa y contractual",
    "Finiquito, saldos, garantías y aprobación de la autoridad competente"
  ],
  "Pagos": [
    "Solicitud y autorización de pago con factura, estimación o entregable respaldante",
    "Registros presupuestarios, contables y de tesorería, incluidas retenciones y saldos"
  ],
  "Operación": [
    "Acta de entrega o puesta en operación y designación de responsables",
    "Manual operativo, recursos, turnos, controles y protocolos aplicables"
  ],
  "Mantenimiento": [
    "Manual y plan de mantenimiento preventivo y correctivo",
    "Presupuesto, responsables, inventario de repuestos y registros de intervenciones"
  ],
  "Cierre": [
    "Informe de cierre técnico, administrativo, financiero y documental",
    "Aprobación final, archivo, garantías vigentes y asuntos pendientes"
  ],
  "Continuidad": [
    "Plan de continuidad, contingencia y respuesta a fallas o sequía",
    "Modelo de sostenibilidad con responsables, financiamiento, repuestos y capacidad operativa"
  ],
  "Calidad del servicio": [
    "Plan de monitoreo con indicadores de calidad, presión, continuidad y cobertura",
    "Registros periódicos de servicio y resultados de control sanitario trazables"
  ]
} as const satisfies Record<(typeof WATER_CATEGORY_DATA)[number][0], readonly string[]>;

export const WATER_RESEARCH_CATEGORIES = WATER_CATEGORY_DATA.map(([title, focus, patterns]) => ({
  title,
  focus,
  evidencePatterns: patterns.split("|"),
  requiredEvidence: [...WATER_REQUIRED_EVIDENCE[title]],
}));

const researchStep = (category: (typeof WATER_RESEARCH_CATEGORIES)[number]): DomainWorkflowTemplateStep => ({
  title: category.title,
  action: `Investigar y validar ${category.focus}. Registrar únicamente hechos respaldados por fuentes aplicables a Antigua Guatemala; cualquier inferencia debe quedar marcada para revisión humana.`,
  requiredDocuments: [...category.requiredEvidence],
  outputDocuments: [`Registro de evidencia y brecha: ${category.title}`],
  evidencePatterns: category.evidencePatterns,
  notes: `Categoría configurable del flujo. Sólo se presenta como requisito confirmado cuando existe una cita aplicable. ${WATER_PENDING_SOURCE}`,
});

export const potableWaterWorkflowTemplate: DomainWorkflowTemplate = {
  workflowType: "potable_water_project",
  title: "Flujo de investigación para llevar agua potable a una comunidad",
  defaultSummary: "Organicé 47 categorías configurables para investigar un proyecto de agua potable. El flujo distingue pasos respaldados, inferencias para revisión y cobertura documental pendiente; la plantilla no confirma por sí sola requisitos, responsables, sistemas ni plazos.",
  validationWarning: "Borrador de investigación Antigua-first. No ejecutar ni aprobar el proyecto con base exclusiva en esta plantilla; cada paso requiere evidencia citable, vigencia, jurisdicción y revisión humana.",
  steps: WATER_RESEARCH_CATEGORIES.map(researchStep),
};
