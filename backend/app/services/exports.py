"""Rendering a report to the two formats the console offers.

One module for both because they render the *same* `SimulationReportRead` and
must not disagree about it: the CSV is the evidence in full, the PDF is the
conclusion with a readable slice of the evidence under it.

Formatting rules that are deliberate:

- **Numbers are written with a dot**, not the locale's comma. A CSV is read by a
  parser (or by a spreadsheet in an English locale), and `12,4` in an unquoted
  field is two fields.
- **The CSV carries a UTF-8 byte-order mark.** Excel on Windows opens UTF-8 CSV
  without one as Latin-1, which turns `vehículos` into `vehÃ­culos`. The BOM is
  invisible to every parser that matters and is the difference between the file
  opening correctly and not.
- **The PDF is generated, not screenshotted**: reportlab's platypus lays it out
  from the numbers, so a number cannot be stale relative to what it is drawn
  next to. It uses Helvetica, which covers every glyph the report prints, so the
  content is kept Latin-1 safe rather than pulling in a font file.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from io import BytesIO, StringIO
import csv

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.schemas.report import SimulationMetricRead, SimulationReportRead
from app.schemas.session import SimulationSessionRead

CSV_COLUMNS = (
    "tick",
    "t_seconds",
    "strategy",
    "average_wait_seconds",
    "throughput_per_minute",
    "emergency_response_seconds",
    "longest_queue",
)

# A run of a few minutes has hundreds of windows; a printable page holds a dozen
# rows. The PDF shows an evenly spaced sample and says how many rows it sampled
# from, so the slice is never mistaken for the whole run.
PDF_SAMPLE_ROWS = 14

_INK = colors.HexColor("#1F2A3D")
_MUTED = colors.HexColor("#5A6B85")
_ACCENT = colors.HexColor("#14B8A6")
_RULE = colors.HexColor("#D7DEE8")
_ZEBRA = colors.HexColor("#F5F7FA")


def export_filename(session: SimulationSessionRead, extension: str) -> str:
    """`urbansync-20261015-0800-3f2a9c1b.csv`.

    The start time says which run it is at a glance and the id prefix keeps two
    runs that started in the same minute apart. ASCII only: a filename travels
    through `Content-Disposition` and browsers disagree about encoded ones.
    """
    started = session.started_at.strftime("%Y%m%d-%H%M")
    return f"urbansync-{started}-{str(session.id)[:8]}.{extension}"


def _number(value: float, places: int = 3) -> str:
    """Fixed-point with a dot, never a locale decimal comma."""
    return f"{value:.{places}f}"


def _seconds(value: float) -> str:
    return f"{_number(value, 1)} s"


def report_to_csv(report: SimulationReportRead) -> str:
    """One row per strategy per sample window, in measurement order.

    Long format rather than one row per window with both strategies' columns
    side by side: the long form matches the `simulation_metrics` table exactly,
    survives a run that measured one policy and not the other, and does not need
    its header renamed if a third strategy is ever compared.
    """
    buffer = StringIO(newline="")
    # CRLF is RFC 4180's line terminator and what Excel expects, whatever the
    # generating host uses.
    writer = csv.writer(buffer, lineterminator="\r\n")

    writer.writerow(CSV_COLUMNS)
    for sample in report.samples:
        writer.writerow(
            (
                sample.tick,
                _number(sample.t, 1),
                sample.strategy.value,
                _number(sample.average_wait_seconds),
                _number(sample.throughput_per_minute),
                _number(sample.emergency_response_seconds),
                sample.longest_queue,
            )
        )

    return buffer.getvalue()


def _downsample(
    samples: Sequence[SimulationMetricRead], limit: int
) -> list[SimulationMetricRead]:
    """Evenly spaced slice, keeping the window order and both endpoints.

    Round-robin by index rather than a mean: the PDF prints the run's own
    readings, and an averaged row would be a number nobody measured.
    """
    if len(samples) <= limit:
        return list(samples)

    step = (len(samples) - 1) / (limit - 1)
    return [samples[round(index * step)] for index in range(limit)]


def windows(
    samples: Sequence[SimulationMetricRead],
) -> list[dict[str, SimulationMetricRead]]:
    """Group the stored rows back into windows, one entry per sample instant.

    The table's shape is long (one row per strategy), but a person reads the
    comparison *per window*: two policies on the same traffic at the same
    second. Sampling the flat list instead would drop every other strategy row
    and print a table where adaptive and fixed never share a line — the
    comparison the report exists to make, gone inside its own evidence.

    Keyed by tick rather than by `t` because the tick is the run's own index and
    two windows cannot collide on it.
    """
    grouped: dict[int, dict[str, SimulationMetricRead]] = {}

    for sample in samples:
        grouped.setdefault(sample.tick, {})[sample.strategy.value] = sample

    return [grouped[tick] for tick in sorted(grouped)]


def _table_style(rows: int) -> TableStyle:
    commands: list[tuple[object, ...]] = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (1, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 0), (-1, 0), _INK),
        ("TEXTCOLOR", (0, 1), (0, -1), _MUTED),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, _RULE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    # One zebra row, derived from the table's own height so the document's two
    # tables do not need their sizes passed in from the outside.
    for row in range(2, rows, 2):
        commands.append(("BACKGROUND", (0, row), (-1, row), _ZEBRA))
    return TableStyle(commands)


def _footer(canvas: Canvas, document: SimpleDocTemplate) -> None:
    """Page counter and the product line. Drawn after layout, on every page."""
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(_MUTED)
    canvas.drawString(
        document.leftMargin,
        12 * mm,
        "UrbanSync Sim - proyecto academico, I.U. Pascual Bravo",
    )
    canvas.drawRightString(
        A4[0] - document.rightMargin,
        12 * mm,
        f"Pagina {document.page}",
    )
    canvas.setStrokeColor(_ACCENT)
    canvas.setLineWidth(1)
    canvas.line(document.leftMargin, 17 * mm, A4[0] - document.rightMargin, 17 * mm)
    canvas.restoreState()


def verdict_line(adaptive: float, fixed: float) -> str:
    """The claim the run actually supports, including where it does not.

    A zero baseline has no percentage, an adaptive wait that is not lower is not
    a win, and a tie is a tie. Printing a favourable percentage in any of those
    cases would be the report arguing past its own numbers.
    """
    if fixed <= 0:
        return "No hay una espera de referencia del ciclo fijo contra la que comparar."

    difference = adaptive - fixed
    share = abs(difference) / fixed * 100

    if abs(difference) < 0.05:
        return "Ambos controladores rinden prácticamente igual en esta corrida."

    if difference < 0:
        return (
            "El control adaptativo reduce la espera media en "
            f"{_number(abs(difference), 1)} s "
            f"({_number(share, 1)} % menos que el ciclo fijo)."
        )

    return (
        "En esta corrida el ciclo fijo espera menos: "
        f"{_number(abs(difference), 1)} s menos que el adaptativo "
        f"({_number(share, 1)} %)."
    )


def report_to_pdf(report: SimulationReportRead) -> bytes:
    """A two-page report: identity and verdict, then sampled evidence."""
    session = report.session
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=24 * mm,
        title=f"UrbanSync Sim - corrida {str(session.id)[:8]}",
        author="UrbanSync Sim",
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=_INK,
        alignment=0,
        spaceAfter=2,
    )
    eyebrow = ParagraphStyle(
        "ReportEyebrow",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=_MUTED,
        spaceAfter=10,
    )
    heading = ParagraphStyle(
        "ReportHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=_INK,
        spaceBefore=14,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=_MUTED,
    )

    # `started_at` arrives timezone-aware; printing it as-is would put `+00:00`
    # on a line a reader interprets as local. The run's clock is UTC, so say so.
    started = session.started_at.strftime("%Y-%m-%d %H:%M UTC")
    duration = (
        f"{_number(session.duration_seconds / 60, 1)} min"
        if session.duration_seconds is not None
        else "sin cerrar"
    )
    mode = "Adaptativo" if session.mode.value == "adaptive" else "Ciclo fijo"

    flow: list[object] = [
        Paragraph("Informe de corrida", title),
        Paragraph(
            "UrbanSync Sim - cruce adaptativo con priorización de emergencia",
            eyebrow,
        ),
        Paragraph("Identificación", heading),
        Table(
            [
                ["Corrida", str(session.id)],
                ["Inicio", started],
                ["Duración", duration],
                ["Política activa", mode],
                ["Ventanas de muestra", str(session.tick_count)],
                ["Vehículos atendidos", str(session.vehicles_processed)],
            ],
            colWidths=[42 * mm, 132 * mm],
            style=_table_style(6),
        ),
    ]

    if session.adaptive is not None and session.fixed is not None:
        adaptive = session.adaptive
        fixed = session.fixed

        flow.extend(
            [
                Paragraph("Comparación de controladores", heading),
                Table(
                    [
                        ["Lectura", "Adaptativo", "Ciclo fijo"],
                        [
                            "Espera media",
                            _seconds(adaptive.average_wait_seconds),
                            _seconds(fixed.average_wait_seconds),
                        ],
                        [
                            "Caudal",
                            f"{_number(adaptive.throughput_per_minute, 1)} veh/min",
                            f"{_number(fixed.throughput_per_minute, 1)} veh/min",
                        ],
                        [
                            "Respuesta de emergencia",
                            _seconds(adaptive.emergency_response_seconds),
                            _seconds(fixed.emergency_response_seconds),
                        ],
                        [
                            "Cola más larga",
                            f"{adaptive.longest_queue} veh",
                            f"{fixed.longest_queue} veh",
                        ],
                    ],
                    colWidths=[62 * mm, 56 * mm, 56 * mm],
                    style=_table_style(5),
                ),
                Spacer(1, 8),
                Paragraph(
                    verdict_line(
                        adaptive.average_wait_seconds, fixed.average_wait_seconds
                    ),
                    body,
                ),
            ]
        )
    else:
        flow.append(
            Paragraph(
                "La corrida no tiene comparación registrada: se detuvo antes de "
                "producir lecturas o no se guardó su informe.",
                body,
            )
        )

    flow.append(PageBreak())
    flow.append(Paragraph("Evidencia muestreada", heading))

    if report.samples:
        grouped = windows(report.samples)
        shown = _downsample(grouped, PDF_SAMPLE_ROWS)

        def pair(
            window: dict[str, SimulationMetricRead],
            render: Callable[[SimulationMetricRead], str],
        ) -> str:
            """The two policies of one window, or a dash for a side never stored."""
            adaptive = window.get("adaptive")
            fixed = window.get("fixed")
            left = render(adaptive) if adaptive is not None else "-"
            right = render(fixed) if fixed is not None else "-"
            return f"{left} / {right}"

        rows: list[list[str]] = [["t (s)", "Espera A / F", "Caudal A / F", "EVP A / F", "Cola A / F"]]
        for window in shown:
            rows.append(
                [
                    _number(next(iter(window.values())).t, 1),
                    pair(window, lambda sample: _number(sample.average_wait_seconds, 1)),
                    pair(
                        window,
                        lambda sample: _number(sample.throughput_per_minute, 1),
                    ),
                    pair(
                        window,
                        lambda sample: _number(sample.emergency_response_seconds, 1),
                    ),
                    pair(window, lambda sample: str(sample.longest_queue)),
                ]
            )

        flow.append(
            Paragraph(
                "A = adaptativo, F = ciclo fijo. Espera y EVP en segundos; "
                "caudal en vehículos por minuto; cola en vehículos.",
                body,
            )
        )
        flow.append(Spacer(1, 6))
        flow.append(
            Table(
                rows,
                colWidths=[22 * mm, 38 * mm, 38 * mm, 34 * mm, 34 * mm],
                style=_table_style(len(rows)),
            )
        )

        note = (
            f"Mostrando {len(shown)} de {len(grouped)} ventanas de muestra, "
            "espaciadas de forma uniforme. El CSV adjunto incluye todas las "
            "lecturas, una por politica y ventana."
        )
        if len(shown) == len(grouped):
            note = (
                f"Las {len(shown)} ventanas de la corrida, con ambas politicas "
                "en la misma linea."
            )
        flow.append(Spacer(1, 8))
        flow.append(Paragraph(note, body))
    else:
        flow.append(
            Paragraph(
                "No se guardaron lecturas por ventana para esta corrida. El "
                "informe conserva el resumen de ambas políticas.",
                body,
            )
        )

    flow.extend(
        [
            Spacer(1, 16),
            KeepTogether(
                Paragraph(
                    "Las cifras provienen del motor de simulación del backend "
                    "sobre una única secuencia de llegadas, evaluada por los dos "
                    "controladores. No son datos de tráfico real.",
                    body,
                )
            ),
        ]
    )

    document.build(flow, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
