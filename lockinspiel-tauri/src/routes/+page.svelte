<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { supabase } from '$lib/supabaseClient';
  import type { Tables } from '$lib/database.types';
  import { parseTimerLen } from '$lib/timerManager';
  
  let name = $state<string>("");
  let greetMsg = $state<string>("");
  let time_splits = $state([]);
  let selectedTimeSplit = $state<number>(1);

  async function load_time_splits() {
    const { data, error } = await supabase
      .from('time_split')
      .select('*, time_split_timer(*)')
      .eq('deleted', 'false');

    if (error) {
      console.error('Error loading time splits:', error.message);
    } else {
      time_splits = data.map(split => ({
        ...split,
        time_split_timer: split.time_split_timer.sort((a, b) => a.id - b.id)
      })).sort((a, b) => a.id - b.id);
    }
  }

  load_time_splits().then(() => {
    totalTime = parseTimerLen(time_splits.find(s => s.id == selectedTimeSplit)?.time_split_timer[0]?.len ?? 0);
    remainingTime = totalTime;
  });

  async function greet(event: Event) {
    event.preventDefault();
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    greetMsg = await invoke("greet", { name });
  }

  let remainingTime = $state<number>(0);
  let totalTime = $state<number>(0);
  let isRunning = $state<boolean>(false);
  let intervalId = $state<number | null>(null);

  function toggleTimer() {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function startTimer() {
    if (remainingTime <= 0) {
      remainingTime = totalTime;
    }
    isRunning = true;
    intervalId = setInterval(() => {
      if (remainingTime > 0) {
        remainingTime--;
      } else {
        pauseTimer();
      }
    }, 1000) as unknown as number;
  }

  function pauseTimer() {
    isRunning = false;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getProgress(): number {
    return ((totalTime - remainingTime) / totalTime) * 100;
  }
</script>

<main class="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
  <div class="max-w-md w-full">
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 space-y-8">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
          Lockinspiel
        </h1>
        <p class="text-slate-600 dark:text-slate-400">
          Focus and stay productive
        </p>
      </div>

      <div class="relative flex items-center justify-center">
        <svg class="w-64 h-64 transform -rotate-90">
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="currentColor"
            stroke-width="12"
            class="text-slate-200 dark:text-slate-700"
          />
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="currentColor"
            stroke-width="12"
            stroke-linecap="round"
            class="text-blue-600 transition-all duration-300 ease-in-out"
            style={`stroke-dasharray: 753.6; stroke-dashoffset: ${753.6 - (753.6 * getProgress() / 100)}`}
          />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-6xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatTime(remainingTime)}
          </span>
        </div>
      </div>

      <button
        onclick={toggleTimer}
        class="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
      >
        {#if isRunning}
          Pause
        {:else}
          Start
        {/if}
      </button>

      <details id="timer-details" class="space-y-2">
        <summary class="cursor-pointer px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:border-blue-500 dark:hover:border-blue-400 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
          {#if selectedTimeSplit}
            {@const selected = time_splits.find(ts => ts.id === selectedTimeSplit)}
            {selected?.name || '-- Choose a Time Split --'}
          {:else}
            -- Choose a Time Split --
          {/if}
        </summary>
        <div class="mt-2 space-y-3 pl-2">
          {#each time_splits as time_split}
            {#if time_split.id != 0}
              <div
                class="p-4 bg-white dark:bg-slate-800 rounded-xl border-2 {selectedTimeSplit === time_split.id ? 'border-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700'} shadow-md hover:shadow-lg cursor-pointer transition-all hover:-translate-y-0.5"
                onclick={() => {
                  selectedTimeSplit = time_split.id;
                  const details = document.getElementById('timer-details');
                  pauseTimer();
                  totalTime = parseTimerLen(time_split.time_split_timer[0].len);
                  remainingTime = totalTime;
                  details?.removeAttribute('open');
                }}
              >
                <div class="flex justify-between items-start mb-2">
                  <h4 class="font-semibold text-slate-900 dark:text-slate-100 text-lg">
                    {time_split.name}
                  </h4>
                </div>
                {#if time_split.description}
                  <p class="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {time_split.description}
                  </p>
                {/if}
                <div class="space-y-1">
                  <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Timers ({time_split.time_split_timer?.length || 0}):
                  </p>
                  {#if time_split.time_split_timer && time_split.time_split_timer.length > 0}
                    <ul class="space-y-1">
                      {#each time_split.time_split_timer as timer}
                        <li class="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <span class="w-2 h-2 rounded-full {timer.work ? 'bg-green-500' : 'bg-orange-500'}"></span>
                          <span>{timer.name}</span>
                          <span class="font-medium">{timer.len}</span>
                          <span class="text-slate-400">({timer.work ? 'Work' : 'Break'})</span>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="text-xs text-slate-400 dark:text-slate-500 italic">No timers</p>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </details>
    </div>
  </div>
</main>
