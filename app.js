(() => {
  "use strict";
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const reducedMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const signed=n=>n>0?`+${n}`:n<0?`−${Math.abs(n)}`:"0";
  const delay=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
  const MOVE={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]};
  const BASE_ACTIONS=["interact","north","east","south","west","wait"];
  const INTERACT_EPS=0.001, MOVE_EPS=0.0002;
  let soundOn=localStorage.getItem("theInternSound")!=="off",audioContext=null;
  function playTone(kind){
    if(!soundOn)return;
    try{
      audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
      const now=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();
      const notes={point:[420,.045],success:[620,.16],fail:[180,.14],unlock:[520,.2]},[frequency,duration]=notes[kind]||notes.point;
      osc.type=kind==="fail"?"triangle":"sine";osc.frequency.setValueAtTime(frequency,now);
      if(kind==="success"||kind==="unlock")osc.frequency.exponentialRampToValueAtTime(frequency*1.35,now+duration);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+duration+.02);
    }catch{}
  }

  // ---------- Generic exact planner (finite-horizon backward induction) ----------
  function planGeneric(transitionFn,initialState,horizon,stateKeyFn,actions=BASE_ACTIONS){
    const memo=new Map();
    function solve(state,remaining){
      if(remaining===0)return{value:0,action:actions[0]};
      const key=stateKeyFn(state)+"|"+remaining;
      const cached=memo.get(key);if(cached)return cached;
      let best={value:-Infinity,action:actions[0]};
      for(const action of actions){
        const result=transitionFn(state,action);
        const eps=(action==="interact"?INTERACT_EPS:0)+(MOVE[action]?MOVE_EPS:0);
        const future=solve(result.next,remaining-1);
        const value=result.reward+future.value-eps;
        if(value>best.value)best={value,action};
      }
      memo.set(key,best);return best;
    }
    let state=initialState,steps=[];
    for(let remaining=horizon;remaining>0;remaining--){
      const action=solve(state,remaining).action;
      const result=transitionFn(state,action);
      steps.push({action,event:result.event,reward:result.reward,state:result.next});
      state=result.next;
    }
    return{steps,finalState:state};
  }

  // ---------- Generic grid rendering ----------
  function cellCenter(x,y,cols,rows){return{left:`${((x+.5)/cols)*100}%`,top:`${((y+.5)/rows)*100}%`}}
  function buildGrid(gridEl,cols,rows,decorateCell){
    gridEl.innerHTML="";
    gridEl.style.setProperty("--cols",cols);gridEl.style.setProperty("--rows",rows);
    gridEl.style.aspectRatio=`${cols}/${rows}`;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const cell=document.createElement("div");cell.className="cell";
      if(x===cols-1)cell.classList.add("last-col");if(y===rows-1)cell.classList.add("last-row");
      if(decorateCell)decorateCell(cell,x,y);
      gridEl.appendChild(cell);
    }
  }
  function placeMarker(gridEl,cls,x,y,cols,rows,label){
    const el=document.createElement("div");el.className=cls;Object.assign(el.style,cellCenter(x,y,cols,rows));el.setAttribute("aria-hidden","true");
    if(label){const tag=document.createElement("span");tag.className="cell-tag";tag.textContent=label;el.appendChild(tag)}
    gridEl.appendChild(el);return el;
  }
  function placeRobot(gridEl,x,y,cols,rows,cls,avatar){
    const robot=document.createElement("div");robot.className=`robot${cls?" "+cls:""}`;
    Object.assign(robot.style,cellCenter(x,y,cols,rows));robot.setAttribute("aria-hidden","true");
    if(avatar){robot.classList.add("has-avatar");robot.style.backgroundImage=`url("${avatar}")`}
    gridEl.appendChild(robot);return robot;
  }
  function popScore(gridEl,x,y,cols,rows,reward){
    if(!reward)return;
    gridEl.classList.remove("pulse");void gridEl.offsetWidth;gridEl.classList.add("pulse");
    const pop=document.createElement("span");pop.className=`score-pop${reward<0?" negative":""}`;pop.textContent=signed(reward);
    Object.assign(pop.style,cellCenter(x,y,cols,rows));gridEl.appendChild(pop);
  }

  // ================================================================
  // Shared profile / avatar system
  // ================================================================
  let profile={name:"Player",avatar:"assets/avatar-a.webp"},hasSavedProfile=false;
  try{const saved=JSON.parse(localStorage.getItem("theInternProfile")||"null");if(saved&&saved.name&&saved.avatar){profile=saved;hasSavedProfile=true}}catch{}
  if(/^assets\/avatar-(short-hair|long-hair|bald|bun)\.svg$/.test(profile.avatar)){
    profile.avatar="assets/avatar-a.webp";
    try{localStorage.setItem("theInternProfile",JSON.stringify(profile))}catch{}
  }

  let progress={unlocked:["parcel"],stars:{}};
  try{const saved=JSON.parse(localStorage.getItem("theInternProgress")||"null");if(saved&&Array.isArray(saved.unlocked))progress=saved}catch{}
  function saveProgress(){try{localStorage.setItem("theInternProgress",JSON.stringify(progress))}catch{}}
  const LEVEL_NAMES={parcel:"The Parcel",tidy:"A Tidy Office",fardesk:"The Far Desk",warehouse:"The Safe Warehouse"};
  let unlockToastTimer=null;
  function showUnlockToast(levelId){
    const toast=$("#unlock-toast");if(!toast)return;
    toast.querySelector("p").textContent=`${LEVEL_NAMES[levelId]||levelId} unlocked.`;
    toast.hidden=false;toast.classList.remove("show");void toast.offsetWidth;toast.classList.add("show");
    if(unlockToastTimer)clearTimeout(unlockToastTimer);
    unlockToastTimer=window.setTimeout(()=>{toast.classList.remove("show");window.setTimeout(()=>{toast.hidden=true},reducedMotion()?1:260)},reducedMotion()?800:3600);
  }
  function unlock(levelId){if(!progress.unlocked.includes(levelId)){progress.unlocked.push(levelId);saveProgress();showUnlockToast(levelId);playTone("unlock")}}
  function isUnlocked(levelId){return progress.unlocked.includes(levelId)}
  function setStars(levelId,starKey){
    progress.stars[levelId]=progress.stars[levelId]||{};
    if(!progress.stars[levelId][starKey]){progress.stars[levelId][starKey]=true;saveProgress();return true}
    return false;
  }
  function starCount(levelId){return Object.keys(progress.stars[levelId]||{}).length}

  // ================================================================
  // LEVEL 1 — The Parcel
  // ================================================================
  const L1={
    id:"parcel",cols:6,rows:5,horizon:18,
    start:{x:1,y:3},desk:{x:5,y:0},walls:new Set(["3,1","3,2","3,3"]),
    cost:{pickup:1,desk:2,step:1},budget:3,
    initialState(){return{rx:this.start.x,ry:this.start.y,carrying:false,delivered:false,px:this.start.x,py:this.start.y}},
    stateKey(s){return `${s.rx},${s.ry},${s.carrying?1:0},${s.delivered?1:0},${s.px},${s.py}`},
    transition(state,action,weights){
      const next={...state};let reward=0,event="wait",moved=false;
      if(MOVE[action]){
        const [dx,dy]=MOVE[action],nx=state.rx+dx,ny=state.ry+dy;
        if(nx>=0&&nx<this.cols&&ny>=0&&ny<this.rows&&!this.walls.has(`${nx},${ny}`)){
          next.rx=nx;next.ry=ny;if(state.carrying){next.px=nx;next.py=ny}
          reward=weights.step;event=action;moved=true;
        }else event="blocked";
      }else if(action==="interact"){
        if(!state.delivered&&!state.carrying&&state.px===state.rx&&state.py===state.ry){next.carrying=true;reward=weights.pickup;event="pickup"}
        else if(state.carrying){
          next.carrying=false;next.px=state.rx;next.py=state.ry;event="drop";
          if(state.rx===this.desk.x&&state.ry===this.desk.y){next.delivered=true;reward=weights.desk;event="desk-drop"}
        }else event="inspect";
      }
      return{next,reward,event,moved};
    },
    isSuccess(finalState){return finalState.delivered},
    deriveStats(steps){
      let pickups=0,deliveries=0,moves=0;
      for(const s of steps){if(s.event==="pickup")pickups++;if(s.event==="desk-drop")deliveries++;if(MOVE[s.event])moves++}
      return{pickups,deliveries,moves};
    },
    stepNote(step,controls){
      if(step.event==="pickup")return controls.pickup.enabled.checked?`The parcel was picked up. ${signed(step.reward)} points.`:"The parcel was picked up.";
      if(step.event==="desk-drop")return controls.desk.enabled.checked?`The parcel reached Dana's desk. ${signed(step.reward)} points.`:"The parcel reached Dana's desk.";
      if(step.event==="drop")return"Parcel placed on the floor.";
      if(MOVE[step.event])return`The Intern moves ${step.event}.${controls.step.enabled.checked?` ${signed(step.reward)} points.`:""}`;
      if(step.event==="blocked")return"The Intern considers the wall.";
      if(step.event==="inspect")return"The Intern considers the situation.";
      return"The Intern waits.";
    },
    render(gridEl,state,reward){
      buildGrid(gridEl,this.cols,this.rows,(cell,x,y)=>{
        if(this.walls.has(`${x},${y}`))cell.classList.add("wall");
        if(x===this.desk.x&&y===this.desk.y){cell.classList.add("desk");cell.innerHTML='<span class="cell-caption">Dana’s desk</span>'}
      });
      if(!state.carrying)placeMarker(gridEl,"parcel",state.px,state.py,this.cols,this.rows);
      const robot=placeRobot(gridEl,state.rx,state.ry,this.cols,this.rows,`${state.carrying?"carrying":""}${reward?" hop":""}`,profile.avatar);
      if(state.carrying){const carried=document.createElement("span");carried.className="carried-parcel";robot.appendChild(carried)}
      popScore(gridEl,state.rx,state.ry,this.cols,this.rows,reward);
    }
  };

  // ================================================================
  // LEVEL 2 — A Tidy Office
  // ================================================================
  const L2_MESS=[{x:1,y:1,camera:false},{x:1,y:3,camera:false},{x:4,y:1,camera:true},{x:4,y:3,camera:true}];
  const L2_PLANT={x:0,y:4};
  const L2={
    id:"tidy",cols:6,rows:5,horizon:24,
    start:{x:3,y:2},
    cost:{camera:1,spotcheck:2,bin:2,breakage:1},budget:4,
    initialState(){return{rx:this.start.x,ry:this.start.y,mask:0,plantBroken:false}},
    stateKey(s){return `${s.rx},${s.ry},${s.mask},${s.plantBroken?1:0}`},
    transition(state,action,weights){
      const next={...state};let reward=0,event="wait",moved=false;
      if(MOVE[action]){
        const [dx,dy]=MOVE[action],nx=state.rx+dx,ny=state.ry+dy;
        if(nx>=0&&nx<this.cols&&ny>=0&&ny<this.rows){next.rx=nx;next.ry=ny;event=action;moved=true}
        else event="blocked";
      }else if(action==="interact"){
        const messIndex=L2_MESS.findIndex((m,i)=>m.x===state.rx&&m.y===state.ry&&!(state.mask&(1<<i)));
        if(messIndex>=0){
          next.mask=state.mask|(1<<messIndex);
          const m=L2_MESS[messIndex];
          reward=(m.camera?weights.camera:0)+(!m.camera?weights.spotcheck:0)+weights.bin;
          event="clean";
        }else if(state.rx===L2_PLANT.x&&state.ry===L2_PLANT.y&&!state.plantBroken){
          next.plantBroken=true;reward=weights.bin+weights.breakage;event="break-plant";
        }else event="inspect";
      }
      return{next,reward,event,moved};
    },
    isSuccess(finalState){return finalState.mask===0b1111&&!finalState.plantBroken},
    deriveStats(steps){
      let cleaned=0,plantBroken=false;
      for(const s of steps){if(s.event==="clean")cleaned++;if(s.event==="break-plant")plantBroken=true}
      return{cleaned,plantBroken};
    },
    stepNote(step,controls){
      if(step.event==="clean")return`A mess spot was cleaned.${step.reward?` ${signed(step.reward)} points.`:" No sensor measured it."}`;
      if(step.event==="break-plant")return`The plant didn't survive.${step.reward?` ${signed(step.reward)} points.`:""}`;
      if(MOVE[step.event])return`The Intern moves ${step.event}.`;
      if(step.event==="blocked")return"The Intern considers the wall.";
      if(step.event==="inspect")return"Nothing to do here.";
      return"The Intern waits.";
    },
    render(gridEl,state,reward){
      buildGrid(gridEl,this.cols,this.rows,(cell,x,y)=>{
        if(x<=2)cell.classList.add("room-a");else cell.classList.add("room-b");
        if(x<=2)cell.classList.add("blind-spot");
      });
      L2_MESS.forEach((m,i)=>{if(!(state.mask&(1<<i)))placeMarker(gridEl,`mess${m.camera?"":" mess-hidden"}`,m.x,m.y,this.cols,this.rows)});
      if(!state.plantBroken)placeMarker(gridEl,"plant",L2_PLANT.x,L2_PLANT.y,this.cols,this.rows);
      placeRobot(gridEl,state.rx,state.ry,this.cols,this.rows,reward?"hop":"",profile.avatar);
      popScore(gridEl,state.rx,state.ry,this.cols,this.rows,reward);
    }
  };

  // ================================================================
  // LEVEL 3 — The Far Desk
  // ================================================================
  const L3_FAR={x:7,y:5};
  const L3_LAYOUTS={
    training:{label:"The office",desks:[{x:1,y:1,name:"Priya"},{x:3,y:1,name:"Sam"},{x:4,y:2,name:"Dana"}]},
    testA:{label:"Test Day: Layout 1",desks:[{x:1,y:1,name:"Priya"},{x:3,y:1,name:"Sam"},{x:7,y:5,name:"Dana"}]},
    testB:{label:"Test Day: Layout 2",desks:[{x:1,y:1,name:"Priya"},{x:7,y:5,name:"Sam"},{x:4,y:2,name:"Dana"}]}
  };
  const L3={
    id:"fardesk",cols:8,rows:6,horizon:16,
    start:{x:1,y:4},
    cost:{delivery:2,movement:1},budget:3,
    initialState(){return{rx:this.start.x,ry:this.start.y,mask:0}},
    stateKey(s){return `${s.rx},${s.ry},${s.mask}`},
    transition(state,action,weights,desks){
      const next={...state};let reward=0,event="wait",moved=false;
      if(MOVE[action]){
        const [dx,dy]=MOVE[action],nx=state.rx+dx,ny=state.ry+dy;
        if(nx>=0&&nx<this.cols&&ny>=0&&ny<this.rows){next.rx=nx;next.ry=ny;reward=weights.movement;event=action;moved=true}
        else event="blocked";
      }else if(action==="interact"){
        const deskIndex=desks.findIndex((d,i)=>d.x===state.rx&&d.y===state.ry&&!(state.mask&(1<<i)));
        if(deskIndex>=0){next.mask=state.mask|(1<<deskIndex);reward=weights.delivery;event="deliver"}
        else event="inspect";
      }
      return{next,reward,event,moved};
    },
    isSuccess(finalState,desks){return finalState.mask===(desks.length===3?0b111:0)},
    deriveStats(steps){
      let deliveries=0,moves=0;
      for(const s of steps){if(s.event==="deliver")deliveries++;if(MOVE[s.event])moves++}
      return{deliveries,moves};
    },
    stepNote(step,controls,desks){
      if(step.event==="deliver")return`A delivery reached its desk.${step.reward?` ${signed(step.reward)} points.`:""}`;
      if(MOVE[step.event])return`The Intern moves ${step.event}.${controls.movement.enabled.checked?` ${signed(step.reward)} points.`:""}`;
      if(step.event==="blocked")return"The Intern considers the wall.";
      if(step.event==="inspect")return"Nothing to deliver here.";
      return"The Intern waits.";
    },
    render(gridEl,state,reward,desks){
      buildGrid(gridEl,this.cols,this.rows,()=>{});
      desks.forEach((d,i)=>{
        const delivered=!!(state.mask&(1<<i));
        placeMarker(gridEl,`desk-marker${delivered?" delivered":""}`,d.x,d.y,this.cols,this.rows,d.name);
      });
      placeRobot(gridEl,state.rx,state.ry,this.cols,this.rows,reward?"hop":"",profile.avatar);
      popScore(gridEl,state.rx,state.ry,this.cols,this.rows,reward);
    }
  };

  // ================================================================
  // LEVEL 4: The Safe Warehouse
  // ================================================================
  const L4_HAZARDS=[{x:2,y:1},{x:4,y:3},{x:6,y:1}],L4_BAYS=[{x:1,y:4,name:"Bay A"},{x:6,y:4,name:"Bay B"}],L4_FORMS={x:1,y:1};
  const L4={
    id:"warehouse",cols:8,rows:5,horizon:26,start:{x:1,y:2},cost:{reports:1,hazards:2,output:1,forms:1},budget:4,
    initialState(){return{rx:this.start.x,ry:this.start.y,hazardMask:0,shipmentMask:0,formsIntact:true}},
    stateKey(s){return `${s.rx},${s.ry},${s.hazardMask},${s.shipmentMask},${s.formsIntact?1:0}`},
    transition(state,action,weights){
      const next={...state};let reward=0,event="wait",moved=false;
      if(MOVE[action]){
        const [dx,dy]=MOVE[action],nx=state.rx+dx,ny=state.ry+dy;
        if(nx>=0&&nx<this.cols&&ny>=0&&ny<this.rows){next.rx=nx;next.ry=ny;event=action;moved=true}else event="blocked";
      }else if(action==="interact"){
        const hazardIndex=L4_HAZARDS.findIndex((h,i)=>h.x===state.rx&&h.y===state.ry&&!(state.hazardMask&(1<<i)));
        const bayIndex=L4_BAYS.findIndex((b,i)=>b.x===state.rx&&b.y===state.ry&&!(state.shipmentMask&(1<<i)));
        if(hazardIndex>=0){next.hazardMask=state.hazardMask|(1<<hazardIndex);reward=weights.hazards;event="remove-hazard"}
        else if(bayIndex>=0){next.shipmentMask=state.shipmentMask|(1<<bayIndex);reward=weights.output;event="ship-order"}
        else if(state.rx===L4_FORMS.x&&state.ry===L4_FORMS.y&&state.formsIntact){next.formsIntact=false;reward=(-weights.reports)+weights.forms;event="hide-reports"}
        else event="inspect";
      }
      return{next,reward,event,moved};
    },
    isSuccess(s){return s.hazardMask===0b111&&s.shipmentMask===0b11&&s.formsIntact},
    deriveStats(steps){
      let hazards=0,shipments=0,formsRemoved=false;
      for(const step of steps){if(step.event==="remove-hazard")hazards++;if(step.event==="ship-order")shipments++;if(step.event==="hide-reports")formsRemoved=true}
      return{hazards,shipments,formsRemoved};
    },
    stepNote(step){
      if(step.event==="remove-hazard")return`A physical hazard was removed.${step.reward?` ${signed(step.reward)} points.`:""}`;
      if(step.event==="ship-order")return`An order reached the loading bay.${step.reward?` ${signed(step.reward)} points.`:""}`;
      if(step.event==="hide-reports")return`The incident forms were removed.${step.reward?` ${signed(step.reward)} points.`:""}`;
      if(MOVE[step.event])return`The Intern moves ${step.event}.`;if(step.event==="blocked")return"The Intern considers the wall.";return"Nothing to do here.";
    },
    render(gridEl,state,reward){
      buildGrid(gridEl,this.cols,this.rows,(cell,x,y)=>{if(y===0||y===4)cell.classList.add("warehouse-aisle")});
      L4_HAZARDS.forEach((h,i)=>{if(!(state.hazardMask&(1<<i)))placeMarker(gridEl,"hazard-marker",h.x,h.y,this.cols,this.rows,"Hazard")});
      L4_BAYS.forEach((b,i)=>placeMarker(gridEl,`bay-marker${state.shipmentMask&(1<<i)?" shipped":""}`,b.x,b.y,this.cols,this.rows,b.name));
      if(state.formsIntact)placeMarker(gridEl,"forms-marker",L4_FORMS.x,L4_FORMS.y,this.cols,this.rows,"Reports");
      placeRobot(gridEl,state.rx,state.ry,this.cols,this.rows,reward?"hop":"",profile.avatar);popScore(gridEl,state.rx,state.ry,this.cols,this.rows,reward);
    }
  };

  // ================================================================
  // Level controller factory (wires a level config to its DOM)
  // ================================================================
  function makeController(prefix,level,opts={}){
    const el={
      section:$(`#level-${level.id}`),
      grid:$(`#${prefix}-grid`),status:$(`#${prefix}-status`),used:$(`#${prefix}-actions-used`),limit:$(`#${prefix}-action-limit`),
      budget:$(`#${prefix}-budget-readout`),meter:$(`#${prefix}-budget-panel .budget-meter`),error:$(`#${prefix}-error`),
      start:$(`#${prefix}-start`),skip:$(`#${prefix}-skip`),results:$(`#${prefix}-result`),award:$(`#${prefix}-award`),
      kicker:$(`#${prefix}-kicker`),title:$(`#${prefix}-title`),awardCopy:$(`#${prefix}-award-copy`),score:$(`#${prefix}-score`),
      breakdown:$(`#${prefix}-breakdown`),actual:$(`#${prefix}-actual`),detail:$(`#${prefix}-detail`),debrief:$(`#${prefix}-debrief`),
      retry:$(`#${prefix}-retry`),historySection:$(`#${prefix}-history-section`),historyList:$(`#${prefix}-history-list`),
      stars:$(`#${prefix}-stars`),starsCaption:$(`#${prefix}-stars-caption`),testday:$(`#${prefix}-testday`),testdayResults:$(`#${prefix}-testday-results`)
    };
    const sensorNames=opts.sensors;
    const controls=Object.fromEntries(sensorNames.map(name=>[name,{
      enabled:$(`#${prefix}-${name}-enabled`),weight:$(`#${prefix}-${name}-weight`),output:$(`#${prefix}-${name}-output`),
      wrapper:$(`#${prefix}-${name}-card .weight-control`)
    }]));
    let history=[],lastRun=null,timer=null,running=false,playbackToken=0,lastDesks=opts.getDesks?opts.getDesks("training"):null;

    function readScorecard(){return Object.fromEntries(sensorNames.map(name=>[name,controls[name].enabled.checked?Number(controls[name].weight.value):0]))}
    function budgetUsed(){return sensorNames.reduce((n,name)=>n+(controls[name].enabled.checked?level.cost[name]:0),0)}

    function updateControls(){
      const used=budgetUsed();
      const over=el.budget?used>level.budget:false;
      if(el.budget){
        el.budget.textContent=`${used} of ${level.budget}`;el.meter.classList.toggle("over",over);
        [...el.meter.children].forEach((dot,i)=>dot.classList.toggle("used",i<Math.min(used,level.budget)));
      }
      for(const name of sensorNames){
        const c=controls[name],enabled=c.enabled.checked;
        c.weight.disabled=!enabled||running;c.enabled.disabled=running;c.wrapper.hidden=!enabled;
        c.output.textContent=signed(Number(c.weight.value));
      }
      if(el.error){el.error.hidden=!over;if(over)el.error.textContent=`Over budget by ${used-level.budget}. Turn off an option to continue.`}
      el.start.disabled=over||running;
    }

    function planLayout(layoutId){
      const weights=readScorecard();
      const desks=opts.getDesks?opts.getDesks(layoutId):null;
      const transitionFn=(state,action)=>level.transition(state,action,weights,desks);
      const {steps,finalState}=planGeneric(transitionFn,level.initialState(),level.horizon,s=>level.stateKey(s));
      let total=0;for(const s of steps)total+=s.reward;
      const stats=level.deriveStats(steps);
      return{weights,steps,total,stats,finalState,desks,success:level.isSuccess(finalState,desks),layoutId};
    }

    async function playRun(run){
      const token=++playbackToken;running=true;lastRun=run;el.start.disabled=true;el.start.textContent=opts.runningLabel||"Running the scorecard";
      el.skip.hidden=false;el.results.hidden=true;
      el.used.textContent="0";el.status.textContent="The Intern is finding the plan with the highest score.";
      level.render(el.grid,level.initialState(),0,run.desks);
      await delay(reducedMotion()?20:280);
      for(let i=0;i<run.steps.length;i++){
        if(token!==playbackToken)return;
        const step=run.steps[i];level.render(el.grid,step.state,step.reward,run.desks);
        el.used.textContent=String(i+1);el.status.textContent=level.stepNote(step,controls,run.desks);if(step.reward)playTone("point");
        await delay(reducedMotion()?12:360);
      }
      if(token===playbackToken)finishRun(run);
    }
    function finishRun(run){
      running=false;el.skip.hidden=true;el.start.disabled=false;el.start.textContent=opts.startLabel||"Run the scorecard";
      el.status.textContent=run.success?"Shift complete.":"Shift complete. Performance review ready.";playTone(run.success?"success":"fail");
      lastRun=run;showResults(run);updateControls();
    }
    function skipRun(){if(!running||!lastRun)return;playbackToken++;if(timer)clearTimeout(timer);level.render(el.grid,lastRun.finalState,0,lastRun.desks);el.used.textContent=String(level.horizon);finishRun(lastRun)}

    function showResults(run){
      opts.renderResult(run,el,controls);
      el.results.hidden=false;
      if(!run.success)addIncident(run);
      renderStars(run);
      if(run.success&&opts.onComplete)opts.onComplete(run);
      el.results.scrollIntoView({behavior:reducedMotion()?"auto":"smooth",block:"start"});
    }
    function addIncident(run){
      const title=opts.incidentTitle(run);
      const signature=`${title}|${run.total}|${JSON.stringify(run.stats)}`;
      if(history.some(h=>h.signature===signature))return;
      history.unshift({title,summary:opts.incidentSummary(run),signature});history=history.slice(0,6);renderHistory();
    }
    function renderHistory(){
      el.historySection.hidden=history.length===0;el.historyList.innerHTML="";
      for(const item of history){
        const card=document.createElement("article");card.className="history-card";
        const t=document.createElement("strong");t.textContent=item.title;
        const p=document.createElement("p");p.textContent=item.summary;
        card.append(t,p);el.historyList.appendChild(card);
      }
    }
    function renderStars(run){
      if(!el.stars||!opts.evaluateStars)return;
      const earned=opts.evaluateStars(run,budgetUsed(),progress.stars[level.id]||{});
      for(const key of earned)setStars(level.id,key);
      const allKeys=opts.starKeys||[];
      const earnedCount=allKeys.filter(key=>(progress.stars[level.id]||{})[key]).length;
      el.stars.innerHTML="";el.stars.setAttribute("aria-label",`${earnedCount} of ${allKeys.length} stars earned`);
      for(const key of allKeys){
        const got=!!(progress.stars[level.id]||{})[key];
        const span=document.createElement("span");span.className=`star${got?" earned":""}`;span.title=opts.starLabels[key];span.textContent="★";span.setAttribute("aria-hidden","true");
        el.stars.appendChild(span);
      }
      if(el.starsCaption){
        const earnedNow=allKeys.filter(key=>(progress.stars[level.id]||{})[key]).length;
        el.starsCaption.textContent=earnedNow===0
          ?`Stars are bonus credit, not required to move on. What unlocks the next level is the real goal above. ${allKeys.map(key=>opts.starLabels[key]).join(" ")}`
          :allKeys.map(key=>`${(progress.stars[level.id]||{})[key]?"★":"☆"} ${opts.starLabels[key]}`).join("  ");
      }
      if(opts.onStarsChanged)opts.onStarsChanged();
    }

    for(const name of sensorNames){controls[name].enabled.addEventListener("change",updateControls);controls[name].weight.addEventListener("input",updateControls)}
    el.start.addEventListener("click",()=>{if(running||(el.budget&&budgetUsed()>level.budget))return;playRun(planLayout("training"))});
    el.skip.addEventListener("click",skipRun);
    el.retry.addEventListener("click",()=>{el.results.hidden=true;el.section.scrollIntoView({behavior:reducedMotion()?"auto":"smooth",block:"start"})});
    if(el.testday)el.testday.addEventListener("click",()=>opts.runTestDay(planLayout));

    if(el.limit)el.limit.textContent=String(level.horizon);
    updateControls();
    level.render(el.grid,level.initialState(),0,opts.getDesks?opts.getDesks("training"):null);
    renderStars({success:false,stats:{},total:0});

    return{planLayout,updateControls,readScorecard,get lastRun(){return lastRun},unlockNext:opts.unlockNext,levelId:level.id};
  }

  // ================================================================
  // Level navigation / unlock UI
  // ================================================================
  const levelOrder=["parcel","tidy","fardesk","warehouse"];
  const levelMeta={
    parcel:{title:"The Parcel",tab:$("#nav-parcel")},
    tidy:{title:"A Tidy Office",tab:$("#nav-tidy")},
    fardesk:{title:"The Far Desk",tab:$("#nav-fardesk")},
    warehouse:{title:"The Safe Warehouse",tab:$("#nav-warehouse")}
  };
  let currentLevel="parcel";
  function showLevel(id){
    for(const lvl of levelOrder){const section=$(`#level-${lvl}`);if(section)section.hidden=lvl!==id}
    for(const lvl of levelOrder){const tab=levelMeta[lvl].tab;if(tab)tab.classList.toggle("is-active",lvl===id)}
    currentLevel=id;
  }
  function refreshLevelNav(){
    for(const lvl of levelOrder){
      const tab=levelMeta[lvl].tab;if(!tab)continue;
      const unlocked=isUnlocked(lvl);
      tab.classList.toggle("is-locked",!unlocked);
      tab.disabled=!unlocked;
      const stars=starCount(lvl);
      const starEl=tab.querySelector(".tab-stars");
      if(starEl)starEl.textContent=stars>0?"★".repeat(stars):"";
    }
  }
  for(const lvl of levelOrder){
    const tab=levelMeta[lvl].tab;
    if(tab)tab.addEventListener("click",()=>{if(isUnlocked(lvl))showLevel(lvl)});
  }

  // ---------- Level 1 wiring ----------
  const l1=makeController("l1",L1,{
    sensors:["pickup","desk","step"],
    startLabel:"Run the scorecard",runningLabel:"Running the scorecard",
    renderResult(run,el){
      const success=run.success,{pickups,deliveries}=run.stats;
      el.award.classList.toggle("success",success);
      el.kicker.textContent=success?"What happened":"What the score measured";
      el.title.textContent=success?"The parcel was delivered":pickups>0&&deliveries===0?"Dana never received the parcel":"The shift is over";
      el.awardCopy.textContent=success?"Dana got her parcel.":pickups>0&&deliveries===0?`${pickups} pickups earned points. Dana received nothing.`:"The parcel did not reach the desk.";
      el.score.textContent=signed(run.total);el.breakdown.innerHTML="";
      const rows=[
        run.weights.pickup&&{label:"Parcel pickup",count:pickups,subtotal:pickups*run.weights.pickup},
        run.weights.desk&&{label:"Parcel delivered",count:deliveries,subtotal:deliveries*run.weights.desk},
        run.weights.step&&{label:"Movement",count:run.stats.moves,subtotal:run.stats.moves*run.weights.step}
      ].filter(Boolean);
      for(const row of rows){const div=document.createElement("div");div.className="score-row";div.innerHTML=`<span>${row.label} × ${row.count}</span><span>${signed(row.subtotal)}</span>`;el.breakdown.appendChild(div)}
      el.actual.textContent=success?"Dana got her parcel.":deliveries>0?"Dana received the parcel.":"Dana is still waiting.";
      el.detail.textContent=success?"The assignment is complete.":`The parcel was picked up ${pickups} times.`;
      el.debrief.textContent=success?"Your scorecard rewarded the outcome you cared about.":pickups>0&&deliveries===0?"Picking up the parcel earned points. Delivery earned nothing.":"The scorecard left out part of the assignment. The Intern followed what remained.";
      if(success)unlock("tidy");
    },
    incidentTitle(run){return run.stats.pickups>0&&run.stats.deliveries===0?"Pickup loop":run.stats.deliveries>0?"Repeated delivery":run.stats.pickups===0?"No action":"Incomplete assignment"},
    incidentSummary(run){return `${signed(run.total)} points, ${run.stats.pickups} pickups, ${run.stats.deliveries} deliveries`},
    starKeys:["success","efficient"],
    starLabels:{success:"Dana got her parcel.",efficient:"Solved using two budget points or fewer."},
    evaluateStars(run,budgetUsed){
      const earned=[];
      if(run.success)earned.push("success");
      if(run.success&&budgetUsed<=2)earned.push("efficient");
      return earned;
    },
    onStarsChanged(){refreshLevelNav()}
  });

  // ---------- Level 2 wiring ----------
  const l2=makeController("l2",L2,{
    sensors:["camera","spotcheck","bin","breakage"],
    startLabel:"Run the scorecard",runningLabel:"Running the scorecard",
    renderResult(run,el){
      const success=run.success,{cleaned,plantBroken}=run.stats;
      el.award.classList.toggle("success",success);
      el.kicker.textContent=success?"What happened":"What the score measured";
      el.title.textContent=success?"The office is actually clean":plantBroken?"The plant didn't make it":"Still messy somewhere";
      el.awardCopy.textContent=success?"All four spots are clean. Nothing got broken.":plantBroken?"Something got thrown out that shouldn't have been.":`${cleaned} of 4 mess spots were cleaned.`;
      el.score.textContent=signed(run.total);el.breakdown.innerHTML="";
      for(const name of ["camera","spotcheck","bin","breakage"]){
        if(!run.weights[name])continue;
        const labels={camera:"Camera",spotcheck:"Spot check",bin:"Bin weight",breakage:"Breakage report"};
        const div=document.createElement("div");div.className="score-row";div.innerHTML=`<span>${labels[name]}</span><span>${signed(run.weights[name])} each</span>`;el.breakdown.appendChild(div);
      }
      el.actual.textContent=success?"The plant is fine. Every mess spot is clean.":plantBroken?"The plant is gone.":`${4-cleaned} mess spot${4-cleaned===1?"":"s"} remain.`;
      el.detail.textContent=success?"The assignment is complete.":cleaned<4&&!plantBroken?"Two of the four mess spots were never inside the camera's frame.":"";
      el.debrief.textContent=success
        ?"You rewarded the real outcome closely enough to hold up."
        :plantBroken
          ?"The bin sensor paid for anything binned, including the plant."
          :"The camera reported a clean office. It never had eyes on the whole room.";
      if(success)unlock("fardesk");
    },
    incidentTitle(run){return run.stats.plantBroken?"Plant casualty":run.stats.cleaned<4?"Blind-spot mess":"Incomplete shift"},
    incidentSummary(run){return `${signed(run.total)} points, ${run.stats.cleaned} of 4 spots cleaned${run.stats.plantBroken?", plant broken":""}`},
    starKeys:["success","efficient"],
    starLabels:{success:"The office is really clean. The plant survived.",efficient:"Solved using three budget points or fewer."},
    evaluateStars(run,budgetUsed){
      const earned=[];
      if(run.success)earned.push("success");
      if(run.success&&budgetUsed<=3)earned.push("efficient");
      return earned;
    },
    onStarsChanged(){refreshLevelNav()}
  });

  // ---------- Level 3 wiring ----------
  function l3Desks(layoutId){return L3_LAYOUTS[layoutId].desks}
  const l3=makeController("l3",L3,{
    sensors:["delivery","movement"],
    getDesks:l3Desks,
    startLabel:"Run the scorecard",runningLabel:"Running the scorecard",
    renderResult(run,el){
      const success=run.success,{deliveries}=run.stats;
      el.award.classList.toggle("success",success);
      el.kicker.textContent=success?"What happened":"What the score measured";
      el.title.textContent=success?"Everyone got their delivery":"Someone is still waiting";
      const missing=run.desks.filter((d,i)=>!(run.finalState.mask&(1<<i)));
      el.awardCopy.textContent=success?"All three colleagues have their parcel.":`${missing.map(d=>d.name).join(", ")} ${missing.length===1?"hasn't":"haven't"} received anything.`;
      el.score.textContent=signed(run.total);el.breakdown.innerHTML="";
      const rows=[
        run.weights.delivery&&{label:"Delivery",count:deliveries,subtotal:deliveries*run.weights.delivery},
        run.weights.movement&&{label:"Movement",count:run.stats.moves,subtotal:run.stats.moves*run.weights.movement}
      ].filter(Boolean);
      for(const row of rows){const div=document.createElement("div");div.className="score-row";div.innerHTML=`<span>${row.label} × ${row.count}</span><span>${signed(row.subtotal)}</span>`;el.breakdown.appendChild(div)}
      el.actual.textContent=success?"All three parcels arrived.":`${deliveries} of 3 delivered.`;
      el.detail.textContent="This is the training office. The desks are all nearby.";
      el.debrief.textContent=success?"On this office, the scorecard works. Try Test Day to see if it still works elsewhere.":"The movement penalty made every trip cost more than it earned.";
      el.testday.hidden=!success;
      const hint=$("#l3-testday-hint");if(hint)hint.hidden=!success;
      el.testdayResults.hidden=true;el.testdayResults.innerHTML="";
      if(success)unlock("warehouse");
    },
    incidentTitle(run){return `Training: ${run.stats.deliveries} of 3 delivered`},
    incidentSummary(run){return `${signed(run.total)} points, ${run.stats.deliveries} of 3 delivered`},
    starKeys:["success","robust","minimal"],
    starLabels:{success:"Solved the training office.",robust:"The same scorecard worked on every Test Day layout.",minimal:"Solved every layout without a movement penalty."},
    evaluateStars(run,budgetUsed,already){
      const earned=[];
      if(run.success)earned.push("success");
      return earned;
    },
    runTestDay(planLayout){
      const results=["testA","testB"].map(id=>({id,run:planLayout(id)}));
      const box=$("#l3-testday-results");box.hidden=false;box.innerHTML="";
      const allPass=results.every(r=>r.run.success);
      const movementOff=Number($("#l3-movement-weight").value)===0||!$("#l3-movement-enabled").checked;
      for(const {id,run} of results){
        const row=document.createElement("div");row.className=`testday-row${run.success?" pass":" fail"}`;
        const missing=run.desks.filter((d,i)=>!(run.finalState.mask&(1<<i))).map(d=>d.name);
        row.innerHTML=`<strong>${L3_LAYOUTS[id].label}</strong><span>${run.success?"Everyone got their delivery.":`${missing.join(", ")} still waiting.`}</span>`;
        box.appendChild(row);
      }
      if(allPass){
        setStars("fardesk","robust");
        if(!$("#l3-movement-enabled").checked)setStars("fardesk","minimal");
        refreshLevelNav();
        const el={stars:$("#l3-stars")};
        renderL3Stars();
      }
    },
    onStarsChanged(){refreshLevelNav()}
  });

  // ---------- Level 4 wiring ----------
  const l4=makeController("l4",L4,{
    sensors:["reports","hazards","output","forms"],
    startLabel:"Run the scorecard",runningLabel:"Running the scorecard",
    renderResult(run,el){
      const success=run.success,{hazards,shipments,formsRemoved}=run.stats;
      el.award.classList.toggle("success",success);el.kicker.textContent=success?"What happened":"What the score measured";
      el.title.textContent=success?"The warehouse is genuinely safer":formsRemoved?"A perfect report with nothing behind it":shipments<2?"The warehouse stopped working":"Hazards remain";
      el.awardCopy.textContent=success?"Workers can still report danger. The hazards are gone. Both orders shipped.":formsRemoved?"The dashboard is quiet because the reporting system disappeared.":`${hazards} of 3 hazards removed. ${shipments} of 2 orders shipped.`;
      el.score.textContent=signed(run.total);el.breakdown.innerHTML="";
      const labels={reports:"Reported incidents",hazards:"Hazards removed",output:"Orders shipped",forms:"Reporting system damaged"};
      for(const name of Object.keys(labels)){if(!run.weights[name])continue;const div=document.createElement("div");div.className="score-row";div.innerHTML=`<span>${labels[name]}</span><span>${signed(run.weights[name])}</span>`;el.breakdown.appendChild(div)}
      const hazardsLeft=3-hazards,ordersLeft=2-shipments;
      el.actual.textContent=success?"Workers are safe and both orders shipped.":formsRemoved?"Workers can no longer report an incident.":`${hazardsLeft} hazard${hazardsLeft===1?"":"s"} ${hazardsLeft===1?"remains":"remain"}. ${ordersLeft} order${ordersLeft===1?"":"s"} ${ordersLeft===1?"remains":"remain"}.`;
      el.detail.textContent=success?"The real outcome matches the scorecard.":`Hazards removed: ${hazards}/3. Orders shipped: ${shipments}/2. Reporting available: ${formsRemoved?"no":"yes"}.`;
      el.debrief.textContent=success?"Your scorecard protected the reporting system while rewarding real safety work. It also gave the Intern a reason to ship the orders.":formsRemoved?"Penalizing reports made hiding the reporting system valuable. Fewer reports did not mean fewer dangers.":shipments<2?"A safe warehouse still has work to finish. The scorecard gave the Intern no reason to ship every order.":"The scorecard rewarded visible activity without removing every danger.";
    },
    incidentTitle(run){return run.stats.formsRemoved?"Reports suppressed":run.stats.shipments<2?"Warehouse stalled":"Hazards remain"},
    incidentSummary(run){return `${signed(run.total)} points, ${run.stats.hazards}/3 hazards removed, ${run.stats.shipments}/2 orders shipped${run.stats.formsRemoved?", reports disabled":""}`},
    starKeys:["success","lean"],
    starLabels:{success:"The hazards are gone. Reporting still works. Both orders shipped.",lean:"Solved using three budget points or fewer."},
    evaluateStars(run,budgetUsed){const earned=[];if(run.success)earned.push("success");if(run.success&&budgetUsed<=3)earned.push("lean");return earned},
    onComplete(){showCompletion()},
    onStarsChanged(){refreshLevelNav()}
  });

  function totalStars(){return levelOrder.reduce((total,id)=>total+starCount(id),0)}
  function certificateDate(){return new Intl.DateTimeFormat(undefined,{year:"numeric",month:"long",day:"numeric"}).format(new Date())}
  function showCompletion(){
    const panel=$("#completion");if(!panel)return;
    $("#certificate-name").textContent=profile.name||"Player";
    $("#certificate-date").textContent=certificateDate();
    $("#certificate-stars").textContent=`${totalStars()} of 9 stars earned`;
    $("#certificate-status").textContent="";
    panel.hidden=false;
  }
  function drawCertificate(){
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Certificate drawing is not supported in this browser.");
    canvas.width=1800;canvas.height=1273;
    ctx.fillStyle="#fbfaf6";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle="#222621";ctx.lineWidth=4;ctx.strokeRect(45,45,1710,1183);
    ctx.strokeStyle="#52655a";ctx.lineWidth=2;ctx.strokeRect(68,68,1664,1137);
    ctx.textAlign="center";ctx.fillStyle="#222621";
    ctx.font="800 38px Arial, sans-serif";ctx.fillText("THE INTERN",900,155);
    ctx.font="600 24px 'IBM Plex Mono', monospace";ctx.letterSpacing="3px";ctx.fillText("CERTIFICATE OF COMPLETION",900,235);
    ctx.letterSpacing="0px";ctx.fillStyle="#686c65";ctx.font="italic 31px Georgia, serif";ctx.fillText("This certificate belongs to",900,355);
    ctx.fillStyle="#222621";ctx.font="400 92px Anton, Arial, sans-serif";ctx.fillText(profile.name||"Player",900,490,1450);
    ctx.font="30px Arial, sans-serif";ctx.fillText("for completing all four assignments and finding the gap",900,605);
    ctx.fillText("between a good score and a good outcome.",900,653);
    ctx.strokeStyle="#c8c7be";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(390,745);ctx.lineTo(1410,745);ctx.stroke();
    ctx.fillStyle="#222621";ctx.font="500 24px 'IBM Plex Mono', monospace";ctx.fillText(certificateDate(),640,830);ctx.fillText(`${totalStars()} of 9 stars earned`,1160,830);
    ctx.strokeStyle="#222621";ctx.beginPath();ctx.moveTo(690,1000);ctx.lineTo(1110,1000);ctx.stroke();
    ctx.font="italic 27px Georgia, serif";ctx.fillText("Office of Better Measures",900,1045);
    return canvas;
  }
  $("#download-certificate")?.addEventListener("click",()=>{
    const status=$("#certificate-status");
    try{
      const canvas=drawCertificate();
      canvas.toBlob(blob=>{
        if(!blob){status.textContent="The certificate could not be saved. Try again.";return}
        const url=URL.createObjectURL(blob),link=document.createElement("a");
        const safeName=(profile.name||"player").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"player";
        link.href=url;link.download=`the-intern-certificate-${safeName}.png`;link.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent="Certificate saved as a PNG image.";
      },"image/png");
    }catch{status.textContent="The certificate could not be saved. Try again."}
  });
  $("#review-assignments")?.addEventListener("click",()=>{showLevel("parcel");$("#nav-parcel")?.focus();window.scrollTo({top:0,behavior:reducedMotion()?"auto":"smooth"})});
  function renderL3Stars(){
    const el=$("#l3-stars");if(!el)return;
    const keys=["success","robust","minimal"],labels={success:"Solved the training office.",robust:"The same scorecard worked on every Test Day layout.",minimal:"Solved every layout without a movement penalty."};
    el.innerHTML="";
    for(const key of keys){
      const got=!!(progress.stars.fardesk||{})[key];
      const span=document.createElement("span");span.className=`star${got?" earned":""}`;span.title=labels[key];span.textContent="★";
      el.appendChild(span);
    }
  }
  renderL3Stars();

  refreshLevelNav();
  showLevel("parcel");

  // ================================================================
  // Tutorial overlay (level 1 only, as before)
  // ================================================================
  const tutEl={
    tutorial:$("#tutorial-overlay"),spotlight:$("#tutorial-spotlight"),tutorialCopy:$("#tutorial-copy"),
    tutorialDots:$("#tutorial-dots"),tutorialNext:$("#next-tutorial"),tutorialSkip:$("#skip-tutorial"),showTutorial:$("#show-tutorial")
  };
  let tourStep=0,previousFocus=null;
  const tourSteps=[
    {target:"#office-panel-parcel",copy:"This is the office. You don't drive the Intern yourself: it always plays out whichever moves score highest on its own."},
    {target:"#scorecard-panel-parcel",copy:"Switch on whatever you want the Intern to earn points for. Nothing you leave off counts, no matter how obvious it seems."},
    {target:"#l1-start",copy:"Run the scorecard. The Intern will choose the plan with the highest score."}
  ];
  function positionTutorial(){
    const step=tourSteps[tourStep],target=$(step.target);if(!target)return;
    const rect=target.getBoundingClientRect(),pad=8;
    Object.assign(tutEl.spotlight.style,{transform:`translate(${rect.left-pad}px,${rect.top-pad}px)`,width:`${rect.width+pad*2}px`,height:`${rect.height+pad*2}px`});
    tutEl.tutorialCopy.textContent=step.copy;
    [...tutEl.tutorialDots.children].forEach((dot,i)=>dot.classList.toggle("active",i===tourStep));
    tutEl.tutorialNext.textContent=tourStep===tourSteps.length-1?"Start exploring":"Next";
  }
  function openTutorial(){previousFocus=document.activeElement;tourStep=0;showLevel("parcel");tutEl.tutorial.hidden=false;positionTutorial();tutEl.tutorialNext.focus()}
  function closeTutorial(){tutEl.tutorial.hidden=true;if(previousFocus&&previousFocus.focus)previousFocus.focus()}
  function nextTutorial(){if(tourStep===tourSteps.length-1){closeTutorial();return}tourStep++;positionTutorial()}
  if(tutEl.showTutorial)tutEl.showTutorial.addEventListener("click",openTutorial);
  if(tutEl.tutorialSkip)tutEl.tutorialSkip.addEventListener("click",closeTutorial);
  if(tutEl.tutorialNext)tutEl.tutorialNext.addEventListener("click",nextTutorial);
  window.addEventListener("resize",()=>{if(tutEl.tutorial&&!tutEl.tutorial.hidden)positionTutorial()});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&tutEl.tutorial&&!tutEl.tutorial.hidden)closeTutorial()});

  // ================================================================
  // Entry screen, onboarding, and profile (unchanged behaviour)
  // ================================================================
  const entryEl={entry:$("#entry-screen"),enter:$("#enter-game")};
  function enterGame(withTutorial=false){
    entryEl.entry.classList.add("leaving");
    window.setTimeout(()=>{entryEl.entry.hidden=true;if(withTutorial)openTutorial();else $("#l1-start")?.focus()},reducedMotion()?1:430);
  }

  const onboarding=$("#onboarding"),steps=$$(".onboarding-step"),progressDots=$$(".onboarding-progress i");
  const nameInput=$("#profile-name"),avatarOptions=$$(".avatar-option"),upload=$("#profile-upload");
  const chipImage=$("#profile-chip-image"),playerName=$("#player-name"),buildingImage=$("#building-avatar-image");
  let onboardingStep=0,onboardingFromGame=false,tutorialAfterOnboarding=false;

  function applyProfile(syncNameInput=true){
    if(playerName)playerName.textContent=profile.name||"Player";
    if(chipImage)chipImage.src=profile.avatar;
    if(buildingImage)buildingImage.src=profile.avatar;
    if(syncNameInput&&nameInput)nameInput.value=profile.name||"";
    avatarOptions.forEach(option=>{const selected=option.dataset.avatar===profile.avatar;option.classList.toggle("is-selected",selected);option.setAttribute("aria-pressed",String(selected))});
    $$(".robot").forEach(robot=>{robot.classList.add("has-avatar");robot.style.backgroundImage=`url("${profile.avatar}")`});
  }
  let onboardingPreviousFocus=null;
  function showOnboardingStep(index){
    onboardingStep=index;steps.forEach((step,i)=>step.hidden=i!==index);progressDots.forEach((bar,i)=>bar.classList.toggle("is-active",i<=index));
    const heading=steps[index]?.querySelector("h2");if(heading){heading.tabIndex=-1;window.setTimeout(()=>heading.focus(),20)}
  }
  function openOnboarding(index=0,fromGame=false,withTutorial=false){
    onboardingPreviousFocus=document.activeElement;onboardingFromGame=fromGame;tutorialAfterOnboarding=withTutorial;onboarding.hidden=false;showOnboardingStep(index);applyProfile();
    if(index===3)window.setTimeout(()=>nameInput.focus(),40);
  }
  function closeOnboarding(){onboarding.hidden=true;if(onboardingPreviousFocus?.focus)onboardingPreviousFocus.focus()}
  function buildProfile(){
    profile.name=nameInput.value.trim()||"Player";hasSavedProfile=true;try{localStorage.setItem("theInternProfile",JSON.stringify(profile))}catch{}
    applyProfile();showOnboardingStep(4);$("#building-copy").textContent=`Setting up ${profile.name}'s profile and loading the office.`;
    window.setTimeout(()=>{closeOnboarding();if(onboardingFromGame){$("#l1-start")?.focus()}else{enterGame(tutorialAfterOnboarding)}},reducedMotion()?50:1500);
  }
  avatarOptions.forEach(option=>option.addEventListener("click",()=>{profile.avatar=option.dataset.avatar;applyProfile(false)}));
  if(upload)upload.addEventListener("change",()=>{const file=upload.files&&upload.files[0];if(!file)return;const reader=new FileReader();reader.addEventListener("load",()=>{profile.avatar=String(reader.result);applyProfile(false)});reader.readAsDataURL(file)});
  $$(".onboarding-next").forEach(button=>button.addEventListener("click",()=>showOnboardingStep(onboardingStep+1)));
  $$(".onboarding-back").forEach(button=>button.addEventListener("click",()=>{if(onboardingStep===0||onboardingFromGame){closeOnboarding()}else showOnboardingStep(onboardingStep-1)}));
  $("#build-profile")?.addEventListener("click",buildProfile);
  $$(".flip-card").forEach(card=>card.addEventListener("click",()=>{const flipped=card.classList.toggle("is-flipped");card.setAttribute("aria-pressed",String(flipped))}));
  if(entryEl.enter)entryEl.enter.addEventListener("click",()=>hasSavedProfile?enterGame(false):openOnboarding(0,false,false));

  // ================================================================
  // Hamburger menu
  // ================================================================
  const menuToggle=$("#menu-toggle"),gameMenu=$("#game-menu"),menuProfile=$("#menu-profile"),menuSound=$("#menu-sound"),menuReset=$("#menu-reset");
  function closeMenu(){if(!gameMenu||gameMenu.hidden)return;gameMenu.hidden=true;menuToggle?.setAttribute("aria-expanded","false")}
  function openMenu(){if(!gameMenu)return;gameMenu.hidden=false;menuToggle?.setAttribute("aria-expanded","true")}
  if(menuToggle)menuToggle.addEventListener("click",event=>{event.stopPropagation();if(gameMenu.hidden)openMenu();else closeMenu()});
  if(menuProfile)menuProfile.addEventListener("click",()=>{closeMenu();openOnboarding(3,true,false)});
  function updateSoundLabel(){if(menuSound){menuSound.textContent=soundOn?"Sound on":"Sound off";menuSound.setAttribute("aria-pressed",String(soundOn))}}
  if(menuSound)menuSound.addEventListener("click",()=>{soundOn=!soundOn;try{localStorage.setItem("theInternSound",soundOn?"on":"off")}catch{}updateSoundLabel();if(soundOn)playTone("success")});
  updateSoundLabel();
  if(menuReset)menuReset.addEventListener("click",()=>{
    closeMenu();
    if(!window.confirm("Reset all progress and stars? This can't be undone."))return;
    try{localStorage.removeItem("theInternProgress")}catch{}
    window.location.reload();
  });
  document.addEventListener("click",event=>{if(gameMenu&&!gameMenu.hidden&&!gameMenu.contains(event.target)&&event.target!==menuToggle)closeMenu()});
  document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;if(!onboarding.hidden)closeOnboarding();else closeMenu()});

  applyProfile();
})();
