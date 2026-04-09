import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import { type StockPrice } from "../services/api"

interface StockChartProps {
  data: StockPrice[]
  stockName: string
}

export default function StockChart({ data, stockName }: StockChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 480 })

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: 480
      })
    }
  }, [])

  useEffect(() => {
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [handleResize])

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return

    d3.select(svgRef.current).selectAll("*").remove()

    const margin = { top: 20, right: 60, bottom: 40, left: 70 }
    const width = dimensions.width - margin.left - margin.right
    const totalHeight = dimensions.height - margin.top - margin.bottom
    const priceHeight = totalHeight * 0.72
    const volumeHeight = totalHeight * 0.18
    const gap = totalHeight * 0.1

    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)

    const parseTime = d3.timeParse("%Y-%m-%d")
    const sortedData = [...data].sort((a, b) => (parseTime(a.date)?.getTime() || 0) - (parseTime(b.date)?.getTime() || 0))

    const x = d3.scaleBand()
      .domain(sortedData.map(d => d.date))
      .range([0, width])
      .padding(0.3)

    const minLow = d3.min(sortedData, d => d.min) ?? 0
    const maxHigh = d3.max(sortedData, d => d.max) ?? 100
    const pricePadding = (maxHigh - minLow) * 0.05

    const yPrice = d3.scaleLinear()
      .domain([minLow - pricePadding, maxHigh + pricePadding])
      .range([priceHeight, 0])

    const maxVol = d3.max(sortedData, d => d.Trading_Volume ?? d.volume ?? 0) ?? 1
    const yVolume = d3.scaleLinear()
      .domain([0, maxVol * 1.1])
      .range([volumeHeight, 0])

    const priceGroup = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    const volumeGroup = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top + priceHeight + gap})`)

    // Grid lines
    priceGroup.selectAll(".grid-line")
      .data(yPrice.ticks(6))
      .enter().append("line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", d => yPrice(d)).attr("y2", d => yPrice(d))
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.08)
      .attr("stroke-dasharray", "3,3")

    // Axes
    priceGroup.append("g")
      .attr("transform", `translate(0,${priceHeight})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % Math.ceil(sortedData.length / 6) === 0)).tickFormat((d: string) => {
        const parsed = parseTime(d)
        return parsed ? d3.timeFormat("%m/%d")(parsed) : d
      }))
      .selectAll("text")
      .attr("class", "text-[10px] fill-muted-foreground")

    priceGroup.append("g")
      .call(d3.axisRight(yPrice).ticks(6).tickFormat(d => Number(d).toFixed(0)))
      .selectAll("text")
      .attr("class", "text-[10px] fill-muted-foreground")

    volumeGroup.append("g")
      .call(d3.axisRight(yVolume).ticks(3).tickFormat(d => {
        const val = Number(d)
        if (val >= 1e6) return (val / 1e6).toFixed(1) + "M"
        if (val >= 1e3) return (val / 1e3).toFixed(0) + "K"
        return val.toFixed(0)
      }))
      .selectAll("text")
      .attr("class", "text-[10px] fill-muted-foreground")

    const candleWidth = Math.max(x.bandwidth() * 0.75, 4)

    // Candlestick bodies
    priceGroup.selectAll(".candle-body")
      .data(sortedData)
      .enter().append("rect")
      .attr("class", "candle-body")
      .attr("x", d => (x(d.date) ?? 0) + (x.bandwidth() - candleWidth) / 2)
      .attr("y", d => {
        const bodyTop = Math.max(d.open, d.close)
        return yPrice(bodyTop)
      })
      .attr("width", candleWidth)
      .attr("height", d => {
        return Math.max(yPrice(Math.min(d.open, d.close)) - yPrice(Math.max(d.open, d.close)), 1)
      })
      .attr("fill", d => d.close >= d.open ? "#ef4444" : "#10b981")
      .attr("rx", 1)

    // Candlestick wicks
    priceGroup.selectAll(".candle-wick")
      .data(sortedData)
      .enter().append("line")
      .attr("class", "candle-wick")
      .attr("x1", d => (x(d.date) ?? 0) + x.bandwidth() / 2)
      .attr("x2", d => (x(d.date) ?? 0) + x.bandwidth() / 2)
      .attr("y1", d => yPrice(d.max))
      .attr("y2", d => yPrice(d.min))
      .attr("stroke", d => d.close >= d.open ? "#ef4444" : "#10b981")
      .attr("stroke-width", 1.2)

    // Volume bars
    volumeGroup.selectAll(".vol-bar")
      .data(sortedData)
      .enter().append("rect")
      .attr("class", "vol-bar")
      .attr("x", d => (x(d.date) ?? 0) + (x.bandwidth() - candleWidth) / 2)
      .attr("y", d => yVolume(d.Trading_Volume ?? d.volume ?? 0))
      .attr("width", candleWidth)
      .attr("height", d => volumeHeight - yVolume(d.Trading_Volume ?? d.volume ?? 0))
      .attr("fill", d => d.close >= d.open ? "#ef4444" : "#10b981")
      .attr("opacity", 0.45)
      .attr("rx", 1)

    // Separator line
    svg.append("line")
      .attr("x1", margin.left).attr("x2", margin.left + width)
      .attr("y1", margin.top + priceHeight + gap / 2)
      .attr("y2", margin.top + priceHeight + gap / 2)
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-dasharray", "4,4")

    // Tooltip overlay
    const focusGroup = priceGroup.append("g").style("display", "none")
    focusGroup.append("line")
      .attr("class", "crosshair-v")
      .attr("y1", 0).attr("y2", priceHeight)
      .attr("stroke", "hsl(var(--primary))")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-dasharray", "3,3")

    const tooltipDiv = d3.select("body").append("div")
      .attr("class", "fixed hidden bg-popover text-popover-foreground p-3 rounded-lg shadow-xl border text-xs pointer-events-none z-50 min-w-[160px]")

    priceGroup.append("rect")
      .attr("width", width)
      .attr("height", priceHeight)
      .attr("fill", "transparent")
      .on("mousemove touchmove", function(event) {
        const [mouseX] = d3.pointer(event)
        const dateAtMouse = x.domain()[Math.round(mouseX / (width / sortedData.length))] ?? sortedData[0]?.date
        const d = sortedData.find(s => s.date === dateAtMouse)
        if (!d) return

        const xPos = (x(d.date) ?? 0) + x.bandwidth() / 2
        focusGroup.style("display", null).attr("transform", `translate(${xPos},0)`)
        focusGroup.select(".crosshair-v")
          .attr("x1", 0).attr("x2", 0)

        const isUp = d.close >= d.open
        tooltipDiv
          .style("display", "block")
          .html(`
            <div class="font-bold mb-1">${d.date}</div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span class="text-muted-foreground">開:</span><span>${d.open.toFixed(2)}</span>
              <span class="text-muted-foreground">高:</span><span>${d.max.toFixed(2)}</span>
              <span class="text-muted-foreground">低:</span><span>${d.min.toFixed(2)}</span>
              <span class="text-muted-foreground">收:</span><span class="${isUp ? 'text-red-500' : 'text-emerald-500'} font-bold">${d.close.toFixed(2)}</span>
              <span class="text-muted-foreground">量:</span><span>${(d.Trading_Volume ?? d.volume ?? 0).toLocaleString()}</span>
            </div>
          `)
          .style("left", (event.pageX + 16) + "px")
          .style("top", (event.pageY - 10) + "px")
      })
      .on("mouseleave", () => {
        focusGroup.style("display", "none")
        tooltipDiv.style("display", "none")
      })

  }, [data, dimensions])

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex justify-between items-center mb-4 px-2">
        <h4 className="text-sm font-semibold text-primary">{stockName} K 線圖</h4>
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-tighter">D3.js Candlestick</span>
      </div>
      <svg ref={svgRef} className="overflow-visible"></svg>
    </div>
  )
}
