import svgPaths from "./svg-9kbbhvtci4";

function AuthoriseButton() {
  return (
    <div className="-translate-x-1/2 absolute contents left-[calc(50%-4.5px)] top-[68px]" data-name="Authorise Button">
      <div className="-translate-x-1/2 absolute bg-[#1868db] h-[26px] left-[calc(50%-4.5px)] rounded-[5px] top-[68px] w-[111px]" />
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold h-[11px] leading-[normal] left-[calc(50%-35px)] not-italic text-[10px] text-white top-[calc(50%-151px)] w-[62px] whitespace-pre-wrap">Connect Jira</p>
    </div>
  );
}

function AuthoriseSection() {
  return (
    <div className="absolute contents left-[10px] top-[10px]" data-name="Authorise section">
      <div className="absolute bg-[#cfe1fd] h-[98px] left-[10px] rounded-[5px] top-[10px] w-[430px]" />
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[normal] left-[calc(50%-85px)] not-italic text-[#1c2b42] text-[10px] top-[42px]">You are not yet connected with Jira.</p>
      <p className="absolute font-['Orbitron:Black',sans-serif] font-black leading-[normal] left-[calc(50%-41px)] text-[#1868db] text-[14px] top-[19px]">TRACKLET</p>
      <AuthoriseButton />
    </div>
  );
}

function AuthoriseButton1() {
  return (
    <div className="absolute contents left-[173px] top-[321.91px]" data-name="Authorise Button">
      <div className="absolute bg-[#8a8b8d] h-[33.557px] left-[173px] rounded-[5px] top-[321.91px] w-[123.713px]" />
    </div>
  );
}

function PlaySolidFull() {
  return (
    <div className="absolute left-[187.41px] size-[18.011px] top-[329.68px]" data-name="play-solid-full 2">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.0107 18.0107">
        <g id="play-solid-full 2">
          <path d={svgPaths.p12fb200} fill="var(--fill-0, #D9D9D9)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents left-[187.41px] top-[329.68px]">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold h-[15.167px] leading-[normal] left-[calc(50%-7px)] not-italic text-[11px] text-white top-[331px] w-[68.251px] whitespace-pre-wrap">Start Timer</p>
      <PlaySolidFull />
    </div>
  );
}

function TimerStartButton() {
  return (
    <div className="absolute contents left-[173px] top-[321.91px]" data-name="Timer Start Button">
      <AuthoriseButton1 />
      <Group />
    </div>
  );
}

function Block1() {
  return (
    <div className="absolute contents left-[241.37px] top-[186.6px]" data-name="Block 2">
      <div className="absolute bg-[#1868db] h-[116.402px] left-[241.37px] rounded-[5px] top-[186.6px] w-[106.436px]" />
      <p className="absolute font-['Orbitron:Medium',sans-serif] font-medium leading-[normal] left-[calc(50%+28px)] text-[50px] text-white top-[calc(50%-12px)]">35</p>
    </div>
  );
}

function Block() {
  return (
    <div className="absolute contents left-[103px] top-[186.6px]" data-name="Block 1">
      <div className="absolute bg-[#1868db] h-[116.402px] left-[103px] rounded-[5px] top-[186.6px] w-[106.436px]" />
      <p className="absolute font-['Orbitron:Medium',sans-serif] font-medium leading-[normal] left-[calc(50%-108px)] text-[50px] text-white top-[calc(50%-12px)]">24</p>
    </div>
  );
}

function TimerBlock() {
  return (
    <div className="-translate-x-1/2 absolute contents left-[calc(50%+0.4px)] top-[186.6px]" data-name="Timer block">
      <TimerStartButton />
      <Block1 />
      <p className="absolute font-['Instrument_Sans:Bold',sans-serif] font-bold h-[54.649px] leading-[normal] left-[217.95px] text-[47px] text-black top-[212.48px] w-[14.901px] whitespace-pre-wrap" style={{ fontVariationSettings: "\'wdth\' 100" }}>
        :
      </p>
      <Block />
    </div>
  );
}

function Dropdown() {
  return (
    <div className="-translate-x-1/2 absolute contents left-[calc(50%+0.1px)] top-[379.6px]" data-name="Dropdown">
      <div className="absolute bg-[#c6c6c6] h-[36.433px] left-[25px] rounded-[10px] top-[379.6px] w-[400.198px]" />
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium h-[14.381px] leading-[normal] left-[calc(50%-186px)] not-italic text-[#3b3d42] text-[12px] top-[calc(50%+165.03px)] w-[217.392px] whitespace-pre-wrap">Select a ticket to start working</p>
      <div className="absolute inset-[87.83%_10.44%_11.01%_87.11%]" data-name="Vector">
        <div className="absolute inset-[-19.21%_-9.09%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13 7.20523">
            <path d="M12 1L6.5 6.20523L1 1" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function TimerTab() {
  return (
    <div className="absolute contents left-[10px] top-[153px]" data-name="Timer Tab">
      <div className="absolute bg-[#cfe1fd] h-[289px] left-[10px] rounded-[5px] top-[153px] w-[430px]" />
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium h-[11.505px] leading-[normal] left-[calc(50%-106.44px)] not-italic text-[#3b3d42] text-[10px] top-[161.46px] w-[244.802px] whitespace-pre-wrap">Enter a custom duration (e.g., 30 or 60 minutes)</p>
      <TimerBlock />
      <Dropdown />
    </div>
  );
}

function SwitchTabs() {
  return (
    <div className="-translate-x-1/2 absolute contents left-1/2 top-[116px]" data-name="Switch Tabs">
      <div className="absolute bg-[#cfe1fd] h-[29px] left-[10px] rounded-[5px] top-[116px] w-[430px]" />
      <div className="absolute bg-[#1868db] h-[21px] left-[13px] rounded-[5px] top-[120px] w-[210px]" />
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%+77.41px)] not-italic text-[#1868db] text-[10px] top-[124px] tracking-[0.5px] w-[67.054px] whitespace-pre-wrap">ANALYTICS</p>
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[normal] left-[calc(50%-124.69px)] not-italic text-[10px] text-white top-[124px] tracking-[0.5px] w-[36.188px] whitespace-pre-wrap">TIMER</p>
    </div>
  );
}

export default function DefaultScreenBW() {
  return (
    <div className="bg-white relative size-full" data-name="Default Screen B/W">
      <AuthoriseSection />
      <TimerTab />
      <SwitchTabs />
      <div className="absolute inset-[4%_4%_94.22%_94.22%]" data-name="Vector">
        <div className="absolute inset-[-3.13%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8.5 8.5">
            <path d={svgPaths.p32a88700} fill="var(--fill-0, #1868DB)" id="Vector" stroke="var(--stroke-0, #1868DB)" strokeWidth="0.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}