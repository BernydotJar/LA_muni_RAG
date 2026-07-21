import type { DomainWorkflowTemplate, DomainWorkflowTemplateStep } from "../types.js";

export const WATER_PENDING_SOURCE = "Documento o regla pendiente de localizar y validar.";

type WaterCategoryTuple = readonly [title: string, focus: string, patterns: string];

const WATER_CATEGORY_DATA: readonly WaterCategoryTuple[] = [
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
] as const;

export const WATER_RESEARCH_CATEGORIES = WATER_CATEGORY_DATA.map(([title, focus, patterns]) => ({
  title,
  focus,
  evidencePatterns: patterns.split("|"),
}));

const researchStep = (category: (typeof WATER_RESEARCH_CATEGORIES)[number]): DomainWorkflowTemplateStep => ({
  title: category.title,
  action: `Investigar y validar ${category.focus}. Registrar únicamente hechos respaldados por fuentes aplicables a Antigua Guatemala; cualquier inferencia debe quedar marcada para revisión humana.`,
  requiredDocuments: [`Documento o evidencia verificable sobre ${category.title.toLowerCase()}`],
  outputDocuments: [`Registro de evidencia y brecha: ${category.title}`],
  evidencePatterns: category.evidencePatterns,
  notes: `Categoría de investigación; no constituye un hecho predeterminado. ${WATER_PENDING_SOURCE}`,
});

export const potableWaterWorkflowTemplate: DomainWorkflowTemplate = {
  workflowType: "potable_water_project",
  title: "Flujo de investigación para llevar agua potable a una comunidad",
  defaultSummary: "Organicé las 47 categorías de investigación del caso de agua potable. Cada categoría debe permanecer como evidencia, inferencia para revisión o brecha explícita; la plantilla no confirma por sí sola requisitos, responsables, sistemas ni plazos.",
  validationWarning: "Borrador de investigación Antigua-first. No ejecutar ni aprobar el proyecto con base exclusiva en esta plantilla; cada paso requiere evidencia citable, vigencia, jurisdicción y revisión humana.",
  steps: WATER_RESEARCH_CATEGORIES.map(researchStep),
};
