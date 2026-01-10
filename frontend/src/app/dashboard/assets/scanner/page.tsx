'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ArrowLeft, Camera, StopCircle } from 'lucide-react';
import Link from 'next/link';
import { BrowserMultiFormatReader } from '@zxing/browser';

export default function QRScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [scannedData, setScannedData] = useState<string>('');
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    // Initialize code reader
    codeReaderRef.current = new BrowserMultiFormatReader();

    return () => {
      // Cleanup on unmount - stop any active streams
      if (codeReaderRef.current && videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    };
  }, []);

  const startScanning = async () => {
    if (!videoRef.current || !codeReaderRef.current) return;

    try {
      setError('');
      setScannedData('');
      setIsScanning(true);

      // Get video devices
      const videoInputDevices =
        await BrowserMultiFormatReader.listVideoInputDevices();

      if (videoInputDevices.length === 0) {
        setError('Aucune caméra trouvée');
        setIsScanning(false);
        return;
      }

      // Use the first camera (usually back camera on mobile)
      const selectedDeviceId = videoInputDevices[0].deviceId;

      // Start decoding
      codeReaderRef.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const qrData = result.getText();
            setScannedData(qrData);
            setIsScanning(false);

            // Parse QR code URL to extract asset ID
            try {
              const url = new URL(qrData);
              const pathParts = url.pathname.split('/');
              const assetIndex = pathParts.indexOf('assets');
              if (assetIndex !== -1 && pathParts[assetIndex + 1]) {
                const assetId = pathParts[assetIndex + 1];
                const token = url.searchParams.get('token');

                // Redirect to asset detail page
                router.push(`/dashboard/assets/${assetId}${token ? `?token=${token}` : ''}`);
              }
            } catch (e) {
              setError('QR Code invalide');
            }
          }

          if (error && error.name !== 'NotFoundException') {
            console.error(error);
          }
        }
      );
    } catch (err) {
      console.error(err);
      setError('Erreur lors de l\'accès à la caméra');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    // Stop video stream
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/assets">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Scanner QR Code</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scanner un équipement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <p>{error}</p>
            </Alert>
          )}

          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-md aspect-square bg-black rounded-lg overflow-hidden relative">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ display: isScanning ? 'block' : 'none' }}
              />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isScanning ? (
                <Button onClick={startScanning} size="lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Démarrer le scan
                </Button>
              ) : (
                <Button onClick={stopScanning} variant="destructive" size="lg">
                  <StopCircle className="mr-2 h-5 w-5" />
                  Arrêter
                </Button>
              )}
            </div>

            {scannedData && (
              <div className="w-full p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">QR Code détecté:</p>
                <p className="text-xs font-mono break-all">{scannedData}</p>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground max-w-md">
              <p>
                Placez le QR Code de l'équipement devant la caméra pour le scanner.
                Vous serez automatiquement redirigé vers la page de l'équipement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
