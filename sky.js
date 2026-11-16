// 祝日アラーム 公式サイト：夜明けの空（WebGL）。
// 絵に描いた月や丘ではなく、空そのものを計算で描く：大気のグラデーション、粒の細かい星、薄い雲、
// 朝もやに重なる山の稜線、細い月。progress 0 = 夜、1 = 朝。
// WebGL が使えない環境では false を返し、呼び出し側が CSS のグラデーションに切り替える。
(() => {
  "use strict";

  const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uP;        // 0 夜 → 1 朝
uniform float uHorizon;  // 地平線の高さ（画面下からの割合）。負なら山を描かない
uniform float uMoon;     // 月の濃さ（0 で描かない）
uniform float uNarrow;   // 縦長の画面なら 1

float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float hash1(float n){ return fract(sin(n*127.1)*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(11.7,3.1); a*=.5; } return v; }
float noise1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(hash1(i),hash1(i+1.),f); }
// 山の稜線：なだらかな起伏に、細かい凹凸を少しだけ重ねる
float ridge(float x, float seed){
  float v=0., a=.5, f=1.;
  for(int i=0;i<5;i++){ v+=a*noise1(x*f+seed); f*=2.07; a*=.48; seed+=17.3; }
  return v;
}

// 星：格子ごとに 1 つ。大きさと明るさにばらつきを持たせ、ゆっくりまたたく
float starLayer(vec2 uv, float scale, float density, float t){
  vec2 g=uv*scale, id=floor(g), f=fract(g)-.5;
  float r=hash(id);
  if(r>density) return 0.;
  vec2 o=vec2(hash(id+3.1),hash(id+7.7))-.5;
  float d=length(f-o*.7);
  float size=mix(.030,.085,pow(hash(id+1.3),5.));
  float tw=.72+.28*sin(t*(.6+hash(id+9.)*1.6)+r*40.);
  return smoothstep(size,0.,d)*tw*mix(.45,1.,hash(id+5.5));
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float aspect=uRes.x/uRes.y;
  vec2 q=vec2(uv.x*aspect,uv.y);
  float p=clamp(uP,0.,1.);

  float hz=max(uHorizon,0.);
  float h=clamp((uv.y-hz)/(1.-hz),0.,1.);          // 0 地平線 → 1 天頂

  // ---- 大気：夜 → 薄明 → 朝 ----
  vec3 night=mix(vec3(.075,.095,.235),vec3(.022,.030,.095),pow(h,.55));
  vec3 dawn=mix(vec3(.97,.60,.42),vec3(.56,.40,.62),smoothstep(0.,.22,h));
  dawn=mix(dawn,vec3(.20,.22,.50),smoothstep(.12,.55,h));
  dawn=mix(dawn,vec3(.07,.10,.30),smoothstep(.45,1.,h));
  vec3 day=mix(vec3(.99,.83,.66),vec3(.62,.72,.93),smoothstep(0.,.26,h));
  day=mix(day,vec3(.30,.47,.82),smoothstep(.16,.62,h));
  day=mix(day,vec3(.15,.30,.68),smoothstep(.55,1.,h));
  vec3 col=mix(night,dawn,smoothstep(0.,.55,p));
  col=mix(col,day,smoothstep(.5,1.,p));

  // 太陽：地平線の下から昇る
  vec2 sun=vec2(mix(.80,.82,p)*aspect, hz+mix(-.30,mix(.27,.15,uNarrow),smoothstep(.22,1.,p)));
  float sd=length(q-sun);
  float glowAmt=smoothstep(.12,.6,p);
  float morning=smoothstep(.6,1.,p);
  // 光は足し算ではなく「スクリーン」で重ねる（白く飛んだ塊にしない）
  vec3 sunLight=mix(vec3(1.,.60,.34),vec3(1.,.84,.62),morning)*exp(-sd*2.6)*mix(.55,.30,morning)   // 広いにじみ
               +mix(vec3(1.,.84,.62),vec3(1.,.94,.82),morning)*exp(-sd*11.)*.42;                      // 近くの光
  col=1.-(1.-col)*(1.-clamp(sunLight*glowAmt,0.,1.));
  col=mix(col,vec3(1.,.99,.95),smoothstep(.030,.022,sd)*smoothstep(.3,.55,p));                      // 太陽そのもの

  // ---- 星と天の川 ----
  float nightAmt=1.-smoothstep(.08,.5,p);
  if(nightAmt>.001){
    float fade=smoothstep(.02,.35,h);
    float s=starLayer(q,38.,.50,uTime)*1.25+starLayer(q+7.3,84.,.48,uTime)*.85+starLayer(q+19.1,160.,.40,uTime)*.55;
    vec3 tint=mix(vec3(1.,.93,.82),vec3(.82,.89,1.),hash(floor(q*46.)));
    col+=s*tint*nightAmt*fade;
    float band=exp(-pow((uv.y-(.86-uv.x*.30))*4.2,2.));
    col+=vec3(.42,.48,.78)*band*fbm(q*3.4+2.)*.16*nightAmt*fade;
  }

  // ---- 月：細い三日月と地球照 ----
  if(uMoon>.001){
    float r=mix(.052,.040,uNarrow);
    vec2 mc=vec2(mix(.80,.78,uNarrow)*aspect, mix(.80,.88,uNarrow)-p*.42);
    vec2 d=q-mc; float dist=length(d);
    float px=1.5/uRes.y;
    float disc=1.-smoothstep(r-px,r+px,dist);
    float shadow=1.-smoothstep(r*.94-px*2.,r*.94+px*6.,length(d-vec2(r*.42,r*.22)));
    float lit=disc*(1.-shadow);
    float limb=mix(1.,.82,smoothstep(.2,1.,dist/r));
    float moonA=uMoon*(1.-smoothstep(.2,.5,p));
    col=mix(col,vec3(.13,.16,.33),disc*.30*moonA);                       // 暗い側（地球照）はごく淡く
    col=mix(col,vec3(1.,.95,.82)*limb,lit*moonA);
    col+=vec3(1.,.90,.70)*exp(-dist*14.)*.20*moonA;
  }

  // ---- 薄い雲：横に流れる筋。夜明けは下から暖色に照らされる ----
  float cloudAmt=smoothstep(.10,.5,p)*.9+.10;
  vec2 cp=vec2(q.x*.85+uTime*.006,(uv.y-hz)*7.2);
  float cn=fbm(cp+fbm(cp*.6+uTime*.004)*.9);
  float cband=smoothstep(.04,.20,h)*(1.-smoothstep(.36,.70,h));
  float cloud=smoothstep(.44,.74,cn)*cband*cloudAmt;
  vec3 cWarm=mix(vec3(1.,.66,.52),vec3(1.,.82,.70),smoothstep(.0,.5,h));
  vec3 cCol=mix(vec3(.14,.17,.34),cWarm,smoothstep(.15,.6,p));
  cCol=mix(cCol,vec3(1.,.97,.94),smoothstep(.72,1.,p));
  col=mix(col,cCol,cloud*.62);

  // ---- 山の稜線：遠い山ほど、もやに溶ける ----
  if(uHorizon>0.){
    vec3 haze=mix(vec3(.11,.14,.32),vec3(.92,.62,.52),smoothstep(.1,.58,p));
    haze=mix(haze,vec3(.80,.84,.95),smoothstep(.6,1.,p));
    vec3 dark=mix(vec3(.022,.030,.085),vec3(.17,.20,.40),smoothstep(.2,1.,p));
    for(int i=0;i<4;i++){
      float fi=float(i);
      float top=hz*(1.18-fi*.27)+(ridge(q.x*(1.1+fi*.55)+fi*31.7,fi*5.3)-.5)*hz*(.62-fi*.10);
      float m=smoothstep(top+1.5/uRes.y,top-1.5/uRes.y,uv.y);
      float depth=fi/3.;                                  // 0 遠い → 1 近い
      vec3 layer=mix(haze,dark,mix(.30,1.,depth));
      float fog=smoothstep(0.,hz*.42,top-uv.y)*(1.-depth)*.55;   // 稜線のすぐ下は濃く、谷に向かってもやがたまる
      layer=mix(layer,haze,fog);
      col=mix(col,layer,m);
    }
  }

  // わずかな粒子（色の段差を消す）
  col+=(hash(gl_FragCoord.xy+fract(uTime)*61.)-.5)*.012;
  gl_FragColor=vec4(col,1.);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  }

  /** canvas に空を描く関数を返す。使えなければ null。 */
  function createSky(canvas, options) {
    const opt = Object.assign({ horizon: 0.2, moon: 1 }, options);
    let gl = null;
    try {
      gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
      if (!gl) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = {};
      for (const name of ["uRes", "uTime", "uP", "uHorizon", "uMoon", "uNarrow"]) u[name] = gl.getUniformLocation(prog, name);

      let lost = false;
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });

      function resize() {
        const r = canvas.getBoundingClientRect();
        // 画素数を抑える：スマホの高精細画面でも 60fps を保つ
        let scale = Math.min(window.devicePixelRatio || 1, 1.5);
        const limit = 1.9e6;
        if (r.width * r.height * scale * scale > limit) scale = Math.sqrt(limit / (r.width * r.height));
        const w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
      }

      function draw(progress, seconds) {
        if (lost) return;
        gl.uniform2f(u.uRes, canvas.width, canvas.height);
        gl.uniform1f(u.uTime, seconds);
        gl.uniform1f(u.uP, progress);
        gl.uniform1f(u.uHorizon, opt.horizon);
        gl.uniform1f(u.uMoon, opt.moon);
        gl.uniform1f(u.uNarrow, canvas.width < canvas.height ? 1 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      resize();
      return { draw, resize };
    } catch (error) {
      return null;
    }
  }

  window.HolidaySky = { createSky };
})();
