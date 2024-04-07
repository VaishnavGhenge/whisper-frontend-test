import {useCallback, useEffect, useRef, useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import {c} from "vite/dist/node/types.d-aGj9QkWt";

function App() {
    const [transcribedText, setTranscribedText] = useState("Initial text");
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
    const [chunks, setChunks] = useState<Blob[]>([]);
    const pendingTaskIdsRef = useRef<string[]>([]);

    useEffect(() => {
        let intervalId: number | null = null;
        const init = async () => {
            const audioStream = await navigator.mediaDevices.getUserMedia({audio: true});
            const recorder = new MediaRecorder(audioStream);

            recorder.ondataavailable = e => {
                if (e.data.size > 0) {
                    setChunks(prevChunks => [...prevChunks, e.data]);
                }
            };

            recorder.onerror = (e) => {
                console.log("error: ", e);
            }

            recorder.onstart = () => {
                console.log("started");
            }

            recorder.start();

            setStream(audioStream);
            setRecorder(recorder);

            // Send chunks of audio data to the backend at regular intervals
            intervalId = setInterval(() => {
                if (recorder.state === 'recording') {
                    recorder.requestData(); // Trigger dataavailable event
                }
            }, 10000); // Adjust the interval as needed
        }

        void init();

        return () => {
            if(intervalId) {
                clearInterval(intervalId);
            }

            if (recorder && recorder.state === 'recording') {
                recorder.stop();
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        const processAudio = async () => {
            if (chunks.length > 0) {
                // Send the latest chunk to the server for transcription
                const latestChunk = chunks[chunks.length - 1];

                const audioBlob = new Blob([latestChunk]);
                convertBlobToAudioFile(audioBlob);
            }
        };

        void processAudio();
    }, [chunks]);

    const convertBlobToAudioFile = useCallback((blob: Blob) => {
        // Convert Blob to audio file (e.g., WAV)
        // This conversion may require using a third-party library or service
        // For example, you can use the MediaRecorder API to record audio in WAV format directly
        // Alternatively, you can use a library like recorderjs to perform the conversion
        // Here's a simplified example using recorderjs:

        const reader = new FileReader();
        reader.onload = () => {
            const audioBuffer = reader.result; // ArrayBuffer containing audio data

            // Send audioBuffer to Flask server or perform further processing
            sendAudioToFlask(audioBuffer as ArrayBuffer);
        };

        reader.readAsArrayBuffer(blob);
    }, []);

    const sendAudioToFlask = useCallback((audioBuffer: ArrayBuffer) => {
        const formData = new FormData();
        formData.append('audio_file', new Blob([audioBuffer]), `speech_audio.wav`);

        console.log(formData.get("audio_file"));

        fetch('http://localhost:5000/transcribe', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then((data: {task_id: string, status: string})=> {
                pendingTaskIdsRef.current.push(data.task_id);
            })
            .catch(error => {
                console.error('Error sending audio to Flask server:', error);
            });
    }, []);

    useEffect(() => {
        const fetchPendingTranscriptionTasks = () => {
            if(pendingTaskIdsRef.current.length > 0) {
                const taskId = pendingTaskIdsRef.current[0];
                fetch(`http://localhost:5000/get-transcription/${taskId}`, {method: "GET"})
                    .then((response) => response.json())
                    .then((data: {
                        task_id: string;
                        status: string;
                        transcription?: string;
                    }) => {
                       if(data.status === "SUCCESS") {
                           pendingTaskIdsRef.current.shift();
                           setTranscribedText(data.transcription!);
                       }
                    });
            }
        }

        // const intervalId = setInterval(() => {
        //     fetchPendingTranscriptionTasks();
        // }, 5000);

        // return () => {
        //     clearInterval(intervalId);
        // }
    }, []);

    return (
        <>
            <div>
                <a href="https://vitejs.dev" target="_blank">
                    <img src={viteLogo} className="logo" alt="Vite logo"/>
                </a>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className="logo react" alt="React logo"/>
                </a>
            </div>
            <h1>Vite + React</h1>
            <div className="card">
                {/*<button onClick={onClickStartRecording}>*/}
                {/*    Start recording*/}
                {/*</button>*/}

                <button onClick={() => recorder?.stop()}>
                    Stop recording
                </button>
            </div>
            <p style={{
                textAlign: "center",
                backgroundColor: "black",
                color: "white"
            }}>
                <code>{transcribedText}</code>
            </p>
        </>
    )
}

export default App
