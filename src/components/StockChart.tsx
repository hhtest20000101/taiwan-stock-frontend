import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { type StockPrice } from "../services/api"

interface StockChartProps {
  data: StockPrice[]
  stockName: string
}

export default function StockChart({ data, stockName }: StockChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return

    // 清除舊圖表
    d3.select(svgRef.current).selectAll("*").remove()

    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const width = svgRef.current.parentElement?.clientWidth || 800
    const innerWidth = width - margin.left - margin.right
    const height = 300
    const innerHeight = height - margin.top - margin.bottom

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // 解析日期且排序 (FinMind 有時日期順序會亂)
    const parseTime = d3.timeParse("%Y-%m-%d")
    const sortedData = [...data].sort((a, b) => (parseTime(a.date)?.getTime() || 0) - (parseTime(b.date)?.getTime() || 0))

    // 定義比例尺
    const x = d3.scaleTime()
      .domain(d3.extent(sortedData, d => parseTime(d.date) as Date) as [Date, Date])
      .range([0, innerWidth])

    const y = d3.scaleLinear()
      .domain([
        d3.min(sortedData, d => d.close) || 0 * 0.98,
        d3.max(sortedData, d => d.close) || 100 * 1.02
      ] as [number, number])
      .range([innerHeight, 0])

    const yVol = d3.scaleLinear()
      .domain([0, d3.max(sortedData, d => d.volume) || 1000] as [number, number])
      .range([innerHeight, innerHeight * 0.7])

    // 配置 X 軸
    svg.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%m/%d") as any))
      .attr("class", "text-muted-foreground opacity-50")

    // 配置 Y 軸
    svg.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .attr("class", "text-muted-foreground opacity-50")

    // 漸層背景
    const areaGradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "area-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%")

    areaGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "hsl(var(--primary))")
      .attr("stop-opacity", 0.3)

    areaGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "hsl(var(--primary))")
      .attr("stop-opacity", 0)

    // 繪製趨勢線
    const line = d3.line<StockPrice>()
      .x(d => x(parseTime(d.date) as Date))
      .y(d => y(d.close))
      .curve(d3.curveMonotoneX)

    svg.append("path")
      .datum(sortedData)
      .attr("fill", "none")
      .attr("stroke", "hsl(var(--primary))")
      .attr("stroke-width", 2)
      .attr("d", line)

    // 繪製漸層面積
    const area = d3.area<StockPrice>()
      .x(d => x(parseTime(d.date) as Date))
      .y0(innerHeight)
      .y1(d => y(d.close))
      .curve(d3.curveMonotoneX)

    svg.append("path")
      .datum(sortedData)
      .attr("fill", "url(#area-gradient)")
      .attr("d", area)

    // 繪製成交量柱狀
    svg.selectAll(".bar")
      .data(sortedData)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => x(parseTime(d.date) as Date) - 2)
      .attr("y", d => yVol(d.volume))
      .attr("width", 4)
      .attr("height", d => innerHeight - yVol(d.volume))
      .attr("fill", "hsl(var(--muted-foreground))")
      .attr("opacity", 0.2)

    // 互動點 (Tooltip 邏輯)
    const focus = svg.append("g").style("display", "none")
    focus.append("circle").attr("r", 5).attr("fill", "hsl(var(--primary))").attr("stroke", "white").attr("stroke-width", 2)

    const tooltip = d3.select("body").append("div")
      .attr("class", "absolute hidden bg-popover text-popover-foreground p-2 rounded shadow-lg border text-xs pointer-events-none z-50")

    svg.append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .on("mouseover", () => { focus.style("display", null); tooltip.style("display", "block"); })
      .on("mouseout", () => { focus.style("display", "none"); tooltip.style("display", "none"); })
      .on("mousemove", (event) => {
        const mouseX = d3.pointer(event)[0]
        const dateAtMouse = x.invert(mouseX)
        const bisectDate = d3.bisector((d: StockPrice) => parseTime(d.date)).left
        const i = bisectDate(sortedData, dateAtMouse, 1)
        const d0 = sortedData[i - 1]
        const d1 = sortedData[i]
        const d = dateAtMouse.getTime() - (parseTime(d0.date)?.getTime() || 0) > (parseTime(d1?.date)?.getTime() || 0) - dateAtMouse.getTime() ? d1 : d0

        if (d) {
          focus.attr("transform", `translate(${x(parseTime(d.date) as Date)},${y(d.close)})`)
          tooltip
            .html(`<strong>${d.date}</strong><br/>價格: ${d.close}<br/>量: ${d.volume.toLocaleString()}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px")
        }
      })

  }, [data])

  return (
    <div className="w-full h-[300px]">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-semibold text-primary">{stockName} 10 日走勢圖</h4>
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-tighter">D3.js Visualization</span>
      </div>
      <svg ref={svgRef} className="overflow-visible"></svg>
    </div>
  )
}
