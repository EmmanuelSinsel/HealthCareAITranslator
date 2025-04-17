import React, { useState, useEffect, useRef } from "react";
import { ceil, debounce, head } from "lodash";
import  styles from "./Style.js"
import Select from "react-dropdown-select";
import "./styles/global.css"

export default function App() {

  //SUPPORTED LANGUAGES BY THE SpeechRecognition WEB API
  const languages = [
    { value:"de-DE", label:"Deutsch" },
    { value:"en-US", label:"US English" },
    { value:"en-GB", label:"UK English" },
    { value:"es-ES", label:"Español" },
    { value:"es-US", label:"Español de EU" },
    { value:"fr-FR", label:"Français" },
    { value:"hi-IN", label:"हिन्दी Hindi" },
    { value:"id-ID", label:"Bahasa Indonesia" },
    { value:"it-IT", label:"Italiano" },
    { value:"ja-JP", label:"日本語" },
    { value:"ko-KR", label:"한국의" },
    { value:"nl-NL", label:"Nederlands" },
    { value:"pl-PL", label:"Polski" },
    { value:"pt-BR", label:"Português do Brasil" },
    { value:"ru-RU", label:"Русский" },
    { value:"zh-CN", label:"普通话（中国大陆）" },
    { value:"zh-HK", label:"粤語（香港）" },
    { value:"zh-TW", label:"國語（臺灣）"}
  ]
  const [idCounter, setIdCounter] = useState(0)
  const [conversationOriginal, setConversationOriginal] = useState([])
  const [conversationTranslated, setConversationTranslated] = useState([])

  const [speakLeftSide, setSpeakLeftSide] = useState(false)
  const [speakRightSide, setSpeakRightSide] = useState(false)

  const [leftLang, setLeftLang] = useState({ value:"en-US", label:"US English" });
  const [rightLang, setRightLang] = useState({ value:"es-ES", label:"Español" });

  const scrollRef = useRef(null);

  const [currentTranscription, setCurrentTranscription] = useState("")
  const [currentTranslation, setCurrentTranslation] = useState("")

  const translationQueueRef = useRef([]);
  const isTranslatingRef = useRef(false);
  const latestInterimPerId = useRef({});

  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  //RESIZE HANDLER
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // TRANSLATION API CALL
  const translateText = async (text, from_language, to_language) => {
    try {
      const res = await fetch("https://healthcareaitranslator-1.onrender.com/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text:text, from_language:from_language, to_language:to_language })
      })
      const data = await res.json()
      return data.translatedText || "";
    } catch (err) {
      console.error("Translation error", err);
      return "";
    }
  };


  // LEFT SIDE SPEECH RECOGNIZER AND TRANSLATOR
  useEffect(() => {
    const processTranslationQueue = () => { // TRANSLATION QUEUE TO IMPROVE SPEED AND BETTER CONSISTENCY
      if (isTranslatingRef.current || translationQueueRef.current.length === 0) return;

      isTranslatingRef.current = true;
      const { text, timestamp, id } = translationQueueRef.current.shift();

      translateText(text, leftLang.label, rightLang.label)
        .then((translated) => {
          setConversationTranslated(prev =>
            prev.map(msg =>
              msg.id === id
                ? {
                    ...msg,
                    tt: translated.trim(),
                    lastUpdate: timestamp,
                  }
                : msg
            )
          );
        })
        .finally(() => {
          isTranslatingRef.current = false;
          processTranslationQueue();
        });
    };

    const enqueueTranslation = debounce((id, text) => {
      const timestamp = Date.now();
      translationQueueRef.current.push({ id, text, timestamp });
      processTranslationQueue();
    }, 400);

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = leftLang.value;

    recognition.onresult = (event) => {
      const msgId = idCounter - 1;
      const toUpdate = conversationOriginal.find(msg => msg.id === msgId)?.ot || "";
      let currentTranscription = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          const updatedOriginal = conversationOriginal.map(msg =>
            msg.id === msgId
              ? { ...msg, ot: toUpdate + transcript + " " }
              : msg
          );
          setCurrentTranscription("");
          setConversationOriginal(updatedOriginal); // UPDATE THE TRANSCRIPTION IN THE CONVERSATION OBJECT WHEN THE TRANSCRIPTION IS FINALIZED

          const finalText = toUpdate + transcript + " ";
          translationQueueRef.current.push({ id: msgId, text: finalText, timestamp: Date.now() });
          processTranslationQueue();
        } else {
          currentTranscription += transcript;
          const interimFullText = toUpdate + currentTranscription;
          setCurrentTranscription(interimFullText); // TEMPORAL TRANSCRIPTION RENDERING TO IMPROVE PERFORMANCE

          // Actualiza y encola con debounce
          latestInterimPerId.current[msgId] = interimFullText;
          enqueueTranslation(msgId, interimFullText); // QUEUE THE TRANSCRIPTION TO WRITE IN THE TRANSCRIPTION AND TRANSLATION LIST OBJECT
        }
      }
    };

    if (speakLeftSide) {
      recognition.start();
    } else {
      recognition.stop();
      setCurrentTranscription("");
      setCurrentTranslation("");
    }

    return () => {
      recognition.stop();
      enqueueTranslation.cancel();
    };
  }, [speakLeftSide, conversationOriginal, conversationTranslated]);
  

  //RIGHT SIDE SPEECH RECOGNIZER AND TRANSLATOR
  useEffect(() => {
    const processTranslationQueue = () => {
      if (isTranslatingRef.current || translationQueueRef.current.length === 0) return;

      isTranslatingRef.current = true;
      const { text, timestamp, id } = translationQueueRef.current.shift();

      translateText(text, rightLang.label, leftLang.label)
        .then((translated) => {
          setConversationTranslated(prev =>
            prev.map(msg =>
              msg.id === id
                ? {
                    ...msg,
                    tt: translated.trim(),
                    lastUpdate: timestamp,
                  }
                : msg
            )
          );
        })
        .finally(() => {
          isTranslatingRef.current = false;
          processTranslationQueue();
        });
    };

    const enqueueTranslation = debounce((id, text) => {
      const timestamp = Date.now();
      translationQueueRef.current.push({ id, text, timestamp });
      processTranslationQueue();
    }, 400); // Espera 400ms antes de procesar (puedes ajustar)

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = rightLang.value;

    recognition.onresult = (event) => {
      const msgId = idCounter - 1;
      const toUpdate = conversationOriginal.find(msg => msg.id === msgId)?.ot || "";
      let currentTranscription = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          const updatedOriginal = conversationOriginal.map(msg =>
            msg.id === msgId
              ? { ...msg, ot: toUpdate + transcript + " " }
              : msg
          );
          setCurrentTranscription("");
          setConversationOriginal(updatedOriginal);

          const finalText = toUpdate + transcript + " ";
          translationQueueRef.current.push({ id: msgId, text: finalText, timestamp: Date.now() });
          processTranslationQueue();
        } else {
          currentTranscription += transcript;
          const interimFullText = toUpdate + currentTranscription;
          setCurrentTranscription(interimFullText);

          // Actualiza y encola con debounce
          latestInterimPerId.current[msgId] = interimFullText;
          enqueueTranslation(msgId, interimFullText);
        }
      }
    };

    if (speakRightSide) {
      recognition.start();
    } else {
      recognition.stop();
      setCurrentTranscription("");
      setCurrentTranslation("");
    }

    return () => {
      recognition.stop();
      enqueueTranslation.cancel(); // cancela si hay algo pendiente
    };
  }, [speakRightSide, conversationOriginal, conversationTranslated]);


  const talk = (side) => { // SWITCH TO MANAGE THE TRANSLATION AND TRANSCRIPTION FUNCTIONS
    if(side == "L"){
      if(!speakLeftSide){
        setConversationOriginal(prevItems => [...prevItems, {id:idCounter,ot:"",  ol:leftLang.value, side:side}])
        setConversationTranslated(prevItems => [...prevItems, {id:idCounter,tt:"", tl:rightLang.value, side:side}])
        setIdCounter((prev) => prev+1)
        setSpeakRightSide(false)
      }
      setSpeakLeftSide((prev) => !prev);
    }if(side == "R"){
      if(!speakRightSide){
        setConversationOriginal(prevItems => [...prevItems, {id:idCounter,ot:"", ol:rightLang.value, side:side}])
        setConversationTranslated(prevItems => [...prevItems, {id:idCounter,tt:"", tl:leftLang.value, side:side}])
        setIdCounter((prev) => prev+1)
        setSpeakLeftSide(false)
      }
      setSpeakRightSide((prev) => !prev);
    }
  }

  useEffect

  useEffect(() => { // ALWAYS TO BOTTOM HANDLER
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationOriginal]);

  return (
    <div style={{height:"100%", display:"flex", flexDirection:"column", backgroundColor:"lightgray", maxHeight:windowDimensions.height}}>
      <div style={{maxWidth:"800px", margin:" 0 auto", width:"100%", backgroundColor:"white", height:"100%", paddingTop:20, maxHeight:windowDimensions.height, overflow:"hidden", boxShadow:"0px 0px 30px #113971"}}> 
        <div style={{height:"17%", textAlign:"center"}}>
          <img src="https://naomedical.com/wp-content/uploads/2024/11/Nao-Medical-Logo-3.svg" style={{height:"40px"}}></img>
          <h3 style={{fontFamily:"sans-serif", fontWeight:"lighter",color:"#113971"}}>Healthcare <b style={{fontWeight:"bold"}}>Real-Time</b> Translator </h3>
          <h3 style={{fontFamily:"sans-serif", fontWeight:"lighter",color:"#113971", marginTop:-10}}> Powered by <img style={{height:22, }} src="https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg"></img></h3>
          <hr style={{width:"100%", border:" 1px solid", color:"#113971", gap:"20px" }}></hr>
          <br></br>
        </div>
        <div style={{ display: "flex", flexDirection:"column", height:"56%", maxHeight:"56%"}}>
          <div style={{ overflowX:"auto", overflowY:"auto" , height:"100vh", marginTop:20, marginLeft:20, marginRight:20}} ref={scrollRef}>
            {
              conversationOriginal.map(msg => 
                <Message 
                key={msg.id} 
                id={msg.id} 
                originalText={msg.ot} 
                translatedText={conversationTranslated.find(msgT => msgT.id === msg.id)?.tt} 
                originalLanguage={msg.ol} 
                translationLanguage={conversationTranslated.find(msgT => msgT.id === msg.id)?.tl} 
                currentTranscription={currentTranscription}
                currentTranslation={currentTranslation}
                idCounter={idCounter}
                side={msg.side}></Message>
              )
            }
          </div>
        </div>
        <div style={{height:"18%"}}>
          <hr style={{width:"100%", border:" 1px solid", color:"#113971", marginBottom:15 }}></hr>
          <br></br>
          <div style={{ display:"grid", gridTemplateColumns: "50% 50%", bottom:"15px", width:"100%", left:0, right:0}}>
            <div style={{ textAlign:"-webkit-center"}}>
              <button onClick={() => talk("L")} style={{...styles.speakButton,boxShadow:"0px 0px 15px #113971"}}>🎙️
                {
                  speakLeftSide &&
                  <div style={{backgroundColor:"red", height:30, width:30, borderRadius:30, zIndex:10, position:'absolute', textAlign:"center", marginTop:-15, marginLeft:-15}}></div>
                }
              </button>
              <Select style={{...styles.dropDown, borderColor:"#113971", borderWidth:1}} options={languages} onChange={(values) => {
                setLeftLang(values[0])
              }} dropdownPosition="top"/>
            </div>
            <div style={{ textAlign:"-webkit-center"}}>
              <button onClick={() => talk("R")} style={{...styles.speakButton,boxShadow:"0px 0px 15px #4da886", textShadow:"0px 0px 0px #4da886"}}>🎙️
                {
                  speakRightSide &&
                  <div style={{backgroundColor:"red", height:30, width:30, borderRadius:30, zIndex:10, position:'absolute', textAlign:"center", marginTop:-15, marginLeft:-15}}></div>
                }
              </button>
              <Select style={{...styles.dropDown, borderColor:"#4da886", borderWidth:1}} options={languages} onChange={(values) => {
                setRightLang(values[0]);
              }} dropdownPosition="top"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const speak = (lang, text) => { // TEXT TO SPEAK FUNCTION
  let utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
};

const Message = ({id, originalText, translatedText, originalLanguage, translationLanguage, side, currentTranscription, currentTranslation, idCounter}) =>{ // MESSAGE COMPONENT
  const originalTextAreaRef = useRef(null);
  const translatedTextAreaRef = useRef(null);

  const leftColor = "#113971"
  const rightColor = "#4da886"
  const messageSide = () => {
    if(side == "L"){
      return "flex"
    }else{
      side = "R"
      return "flex-end"
    }
  }

  const sideColor = () => {
    if(side == "L"){
      return leftColor
    }else{
      side = "R"
      return rightColor
    } 
  }

  useEffect(() => {
    originalTextAreaRef.current.style.height = "0px";
    const scrollHeight = originalTextAreaRef.current.scrollHeight;
    originalTextAreaRef.current.style.height = scrollHeight + "px";
  }, [originalText, currentTranscription]);

  useEffect(() => {
    translatedTextAreaRef.current.style.height = "0px";
    const scrollHeight = translatedTextAreaRef.current.scrollHeight;
    translatedTextAreaRef.current.style.height = scrollHeight + "px";
  }, [translatedText, currentTranslation]);
  return (
    <div style={{ display:"flex", flexDirection:"column", width:"100%", marginBottom:"20px"}}>
      <div style={{display:"flex", alignSelf:messageSide(), width:"80%"}}>
        {
          side === "R" && 
          <button onClick={() => speak(translationLanguage, translatedText)} style={{...styles.playButton, textShadow:"0 0 0 #4da886"}}>▶</button>
        }
        {
          (id === (idCounter-1) && currentTranslation !== "") ?
          <textarea value={currentTranslation} readOnly style={{...styles.textArea, borderColor:sideColor()}} ref={translatedTextAreaRef}/>
          :
          <textarea value={translatedText} readOnly style={{...styles.textArea, borderColor:sideColor()}} ref={translatedTextAreaRef}/>
        }
        {
          side === "L" &&
          <button onClick={() => speak(translationLanguage, translatedText)} style={{...styles.playButton}}>▶</button>
        }
      </div>
      <div style={{display:"flex", alignSelf:messageSide(), width:"80%"}}>
        {
          side === "R" &&
          <button onClick={() => speak(originalLanguage, originalText)} style={{...styles.playButton, textShadow:"0 0 0 #4da886"}}>▶</button>
        }
        {
          (id === (idCounter-1) && currentTranscription !== "") ?
          <textarea value={currentTranscription} readOnly style={{...styles.textAreaItalic, borderColor:sideColor()}} ref={originalTextAreaRef}/>
          :
          <textarea value={originalText} readOnly style={{...styles.textAreaItalic, borderColor:sideColor()}} ref={originalTextAreaRef}/>
        }
        {
          side === "L" &&
          <button onClick={() => speak(originalLanguage, originalText)} style={{...styles.playButton}}>▶</button> 
        }
      </div>
    </div>
  )
}