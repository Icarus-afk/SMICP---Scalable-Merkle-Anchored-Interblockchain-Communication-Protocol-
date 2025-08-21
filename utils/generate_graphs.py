#!/usr/bin/env python3
"""
SMICP Results Graph Generator
Generates graphs and visualizations from SMICP experimental results
"""

import json
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from pathlib import Path

# Set style for better-looking plots
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

def load_results():
    """Load results from JSON file"""
    with open('results/results.json', 'r') as f:
        return json.load(f)

# Helper: parse time strings like '850ms' or '1.1s' into seconds (float)
def parse_time_to_seconds(tstr):
    t = str(tstr).strip()
    try:
        if t.endswith('ms'):
            return float(t[:-2]) / 1000.0
        if t.endswith('s'):
            return float(t[:-1])
        # fallback: try parse as float (assume seconds)
        return float(t)
    except Exception:
        # if parsing fails return NaN
        return float('nan')

def create_performance_graphs(results):
    """Create performance-related graphs as separate files"""
    performance_data = results['performance']
    
    # Extract data
    volumes = [int(p['volume'].split()[0]) for p in performance_data]
    exec_times = [parse_time_to_seconds(p['executionTime']) for p in performance_data]
    throughputs = [int(p['throughput'].split()[0]) for p in performance_data]
    anchoring_times = [parse_time_to_seconds(p['anchoringTime']) for p in performance_data]
    
    # Graph 1: Volume vs Execution Time (Scalability)
    fig1, ax1 = plt.subplots(1, 1, figsize=(10, 6))
    ax1.plot(volumes, exec_times, 'o-', linewidth=2, markersize=8, color='blue')
    ax1.set_xlabel('Transaction Volume')
    ax1.set_ylabel('Execution Time (seconds)')
    ax1.set_title('Scalability: Volume vs Execution Time')
    ax1.grid(True, alpha=0.3)
    ax1.set_xscale('log', base=2)

    # Add point value annotations for thesis clarity
    for x, y in zip(volumes, exec_times):
        ax1.annotate(f'{y:.2f}s', xy=(x, y), xytext=(0, 8), textcoords='offset points',
                     ha='center', va='bottom', fontsize=10, fontweight='bold', color='#2C3E50')

    plt.tight_layout()
    plt.savefig('Images/scalability_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()

    # Graph 2: Volume vs Throughput
    fig2, ax2 = plt.subplots(1, 1, figsize=(10, 6))
    
    # Use multiple distinct solid colors (no gradients) for readability in thesis
    color_palette = ['#2E86AB', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#34495E']
    bar_positions = np.arange(len(volumes))
    bar_width = 0.6
    bars = ax2.bar(bar_positions, throughputs, width=bar_width,
                   color=[color_palette[i % len(color_palette)] for i in range(len(volumes))],
                   edgecolor='#2C3E50', linewidth=1.6)

    ax2.set_xlabel('Transaction Volume')
    ax2.set_ylabel('Throughput (tx/sec)')
    ax2.set_title('Performance: Volume vs Throughput')
    ax2.set_xticks(bar_positions)
    ax2.set_xticklabels([f'{v} tx' for v in volumes], fontsize=11)
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(0, max(throughputs) * 1.25)  # slightly larger range so bars don't touch top

    # Add value annotations on bars
    for bar, value in zip(bars, throughputs):
        height = bar.get_height()
        ax2.annotate(f'{value} TPS',
                     xy=(bar.get_x() + bar.get_width() / 2, height),
                     xytext=(0, 8), textcoords='offset points',
                     ha='center', va='bottom', fontsize=10, fontweight='bold', color='#2C3E50')

    # Clean spines
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)

    plt.tight_layout()
    plt.savefig('Images/throughput_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    # Graph 3: Volume vs Anchoring Time (Overhead)
    fig3, ax3 = plt.subplots(1, 1, figsize=(10, 6))
    ax3.plot(volumes, anchoring_times, 'd-', linewidth=2, markersize=8, color='red')
    ax3.set_xlabel('Transaction Volume')
    ax3.set_ylabel('Anchoring Time (seconds)')
    ax3.set_title('Anchoring Overhead Analysis')
    ax3.grid(True, alpha=0.3)
    ax3.set_xscale('log', base=2)

    # Add point value annotations for anchoring times
    for x, y in zip(volumes, anchoring_times):
        ax3.annotate(f'{y:.2f}s', xy=(x, y), xytext=(0, 8), textcoords='offset points',
                     ha='center', va='bottom', fontsize=10, fontweight='bold', color='#2C3E50')

    plt.tight_layout()
    plt.savefig('Images/anchoring_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_multichain_graph(results):
    """Create multi-chain coordination visualization as separate files"""
    multichain_data = results['multiChain']
    batches = multichain_data['batches']
    
    # Extract chain data
    chain_ids = [batch['chainId'] for batch in batches]
    processing_times = [parse_time_to_seconds(batch['processingTime']) for batch in batches]
    network_latencies = [parse_time_to_seconds(batch['networkLatency']) for batch in batches]
    
    # Convert network latencies and processing times to milliseconds for clearer visualization
    processing_ms = [pt * 1000.0 for pt in processing_times]
    latencies_ms = [nl * 1000.0 for nl in network_latencies]
    
    # Graph 1: Processing times variation (ms)
    fig1, ax1 = plt.subplots(1, 1, figsize=(10, 6))

    # Use a clear palette of solid colors (no gradients)
    palette = ['#2E86AB', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#34495E']
    proc_colors = [palette[i % len(palette)] for i in range(len(chain_ids))]
    bars1 = ax1.bar(chain_ids, processing_ms, color=proc_colors, edgecolor='white', linewidth=1.8, zorder=3)
    ax1.set_ylabel('Processing Time (ms)')
    ax1.set_title('Processing Time Variation Across Chains')
    ax1.grid(True, alpha=0.3, axis='y')

    # Set y-limit with padding
    ax1.set_ylim(0, max(processing_ms) * 1.25)

    # Add value labels (clear, single-line)
    for bar, time_ms in zip(bars1, processing_ms):
        ax1.text(bar.get_x() + bar.get_width()/2., bar.get_height() + max(processing_ms)*0.02,
                 f'{time_ms:.1f} ms', ha='center', va='bottom', fontsize=10, fontweight='bold', zorder=5)

    plt.tight_layout()
    plt.savefig('Images/processing_time_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()

    # Graph 2: Network latency comparison (ms)
    fig2, ax2 = plt.subplots(1, 1, figsize=(10, 6))

    # Use multiple solid colors for readability, but heights are in ms
    lat_palette = ['#1F618D', '#C0392B', '#27AE60', '#D35400', '#8E44AD', '#2C3E50']
    lat_colors = [lat_palette[i % len(lat_palette)] for i in range(len(chain_ids))]
    bars2 = ax2.bar(chain_ids, latencies_ms, color=lat_colors, edgecolor='white', linewidth=1.8, zorder=3)
    ax2.set_ylabel('Network Latency (ms)')
    ax2.set_title('Network Latency Between Chains')
    ax2.grid(True, alpha=0.3, axis='y')

    # Set y-limit with padding to 1.25x max for consistent appearance
    ax2.set_ylim(0, max(latencies_ms) * 1.25)

    # Add value labels
    for bar, latency_ms in zip(bars2, latencies_ms):
        ax2.text(bar.get_x() + bar.get_width()/2., bar.get_height() + max(latencies_ms)*0.05,
                 f'{latency_ms:.1f} ms', ha='center', va='bottom', fontsize=10, fontweight='bold', zorder=5)

    plt.tight_layout()
    plt.savefig('Images/network_latency_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    # Graph 3: Processing Time vs Network Latency (combined comparison) - use only two colors
    fig3, ax3 = plt.subplots(1, 1, figsize=(10, 6))
    x_pos = np.arange(len(chain_ids))
    width = 0.28  # slightly smaller to avoid visual overlap between paired bars
    gap = 0.04     # small gap between paired bars

    # Single solid color for each metric
    proc_color = '#2E86AB'   # processing time color
    lat_color = '#E74C3C'    # network latency color

    # Compute left/right positions with a small gap
    left_positions = x_pos - (width / 2) - gap
    right_positions = x_pos + (width / 2) + gap

    # Draw bars with white edge separators and higher zorder so bars don't visually merge
    bars3a = ax3.bar(left_positions, processing_ms, width, label='Processing Time (ms)', alpha=1.0,
                     color=proc_color, edgecolor='white', linewidth=1.8, zorder=3)
    bars3b = ax3.bar(right_positions, latencies_ms, width, label='Network Latency (ms)', alpha=1.0,
                     color=lat_color, edgecolor='white', linewidth=1.8, zorder=3)

    ax3.set_ylabel('Time (ms)')
    ax3.set_title('Processing Time vs Network Latency')
    ax3.set_xticks(x_pos)
    ax3.set_xticklabels(chain_ids)
    ax3.legend()

    # Put grid below bars for clarity
    ax3.grid(True, alpha=0.3, axis='y')
    ax3.set_axisbelow(True)

    # Set y-limit to accommodate taller processing bars and small latency bars with padding
    overall_max = max(max(processing_ms), max(latencies_ms))
    ax3.set_ylim(0, overall_max * 1.25)

    # Add annotations for both sets of bars (ms) with higher zorder
    for bar in bars3a:
        h = bar.get_height()
        ax3.annotate(f'{h:.1f} ms', xy=(bar.get_x() + bar.get_width()/2, h), xytext=(0, 5),
                     textcoords='offset points', ha='center', va='bottom', fontsize=9, fontweight='bold', zorder=5)
    for bar in bars3b:
        h = bar.get_height()
        ax3.annotate(f'{h:.1f} ms', xy=(bar.get_x() + bar.get_width()/2, h), xytext=(0, 5),
                     textcoords='offset points', ha='center', va='bottom', fontsize=9, fontweight='bold', zorder=5)

    # Remove top/right spines for a clean thesis look
    ax3.spines['top'].set_visible(False)
    ax3.spines['right'].set_visible(False)

    plt.tight_layout()
    plt.savefig('Images/multichain_comparison.png', dpi=300, bbox_inches='tight')
    plt.close()

def create_workflow_graph(results):
    """Create workflow performance visualization - cumulative time only"""
    workflow_data = results['workflow']
    
    # Extract data
    step_names = [step['name'] for step in workflow_data]
    step_times = [parse_time_to_seconds(step['time']) for step in workflow_data]
    
    # Create figure with single subplot
    fig, ax = plt.subplots(1, 1, figsize=(12, 6))
    fig.suptitle('SMICP Workflow Performance Analysis', fontsize=16, fontweight='bold')
    
    # Cumulative time progression
    cumulative_times = np.cumsum(step_times)
    ax.plot(range(len(step_names)), cumulative_times, 'o-', linewidth=3, markersize=8, color='darkblue')
    ax.fill_between(range(len(step_names)), cumulative_times, alpha=0.3, color='lightblue')
    ax.set_xlabel('Workflow Steps')
    ax.set_ylabel('Cumulative Time (seconds)')
    ax.set_title('Cumulative Execution Time Progression')
    ax.set_xticks(range(len(step_names)))
    ax.set_xticklabels([f'Step {i+1}' for i in range(len(step_names))])
    ax.grid(True, alpha=0.3)
    
    # Add final time annotation
    ax.annotate(f'Total: {cumulative_times[-1]:.1f}s', 
                xy=(len(step_names)-1, cumulative_times[-1]),
                xytext=(len(step_names)-2, cumulative_times[-1]+2),
                arrowprops=dict(arrowstyle='->', color='red'),
                fontsize=12, fontweight='bold', color='red')
    
    plt.tight_layout()
    plt.savefig('Images/workflow_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()

def main():
    """Main function to generate all graphs"""
    # Create Images directory if it doesn't exist
    Path('Images').mkdir(exist_ok=True)
    
    # Load results
    print("Loading experimental results...")
    results = load_results()
    
    # Generate graphs
    print("Generating performance analysis graphs...")
    create_performance_graphs(results)
    
    print("Generating multi-chain coordination graphs...")
    create_multichain_graph(results)
    
    print("Generating workflow analysis graphs...")
    create_workflow_graph(results)
    
    print("\nAll graphs generated successfully!")
    print("Generated files:")
    print("- Images/scalability_analysis.png")
    print("- Images/throughput_analysis.png") 
    print("- Images/anchoring_analysis.png")
    print("- Images/processing_time_analysis.png")
    print("- Images/network_latency_analysis.png")
    print("- Images/multichain_comparison.png")
    print("- Images/workflow_analysis.png")
    
    print("\nTo include these in your LaTeX document, add:")
    print("\\usepackage{graphicx}")
    print("And reference them with:")
    print("\\includegraphics[width=\\textwidth]{Images/performance_analysis.png}")

if __name__ == "__main__":
    main()
