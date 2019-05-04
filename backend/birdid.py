import os
import cv2
import numpy as np
import pandas as pd
from scipy import stats
from scipy import signal
from scipy.io import wavfile
import sys
import pickle
from time import time
from tqdm import tqdm
import torch
import torch.optim as optim
import torch.nn as nn
import torch.nn.functional as F
import torch.utils.data as data
import torchvision
import torchvision.transforms as transforms
import torchvision.datasets as datasets
import torchvision.models as models


N_CLASS = 81


class ABLoader(data.Dataset):
    def __init__(self, test_chunks=[], train=True, transform=None):
      self.transform = transform
      
      if train:
        # Train Data
        self.chunks = train_chunks
        self.labels = train_labels
      
      else:
        # Test Data
        self.chunks = test_chunks
        self.labels = np.zeros(test_chunks.shape)
        
      # Transfrom from (x,128,256) ==> (32,32,3,x) [x,1,128, 10229]
      self.chunks = self.chunks.reshape(-1,1,128,256)
      
    def __getitem__(self, idx):
        image = self.chunks[idx,:,:]
        label = self.labels[idx]
        
        if self.transform:
            image = self.transform(image)
        return image, label

    def __len__(self):
        return self.labels.shape[0]


class CubeNet(nn.Module):
    def __init__(self):
        super(CubeNet,self).__init__()
        self.d1 = nn.Dropout(p=0.2)
        self.m1 = nn.BatchNorm2d(1)
        self.c1 = nn.Conv2d(1, 64, kernel_size=(5, 5), stride=(1, 2), padding=2) 
        self.s2 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))
        self.m3 = nn.BatchNorm2d(64)
        self.c3 = nn.Conv2d(64, 64, kernel_size=(5, 5), stride=(1, 1), padding=2)
        self.s4 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))
        self.m5 = nn.BatchNorm2d(64)
        self.c5 = nn.Conv2d(64, 128, kernel_size=(5, 5), stride=(1, 1), padding=2)
        self.s6 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))
        self.m7 = nn.BatchNorm2d(128)
        self.c7 = nn.Conv2d(128, 256, kernel_size=(5, 5), stride=(1, 1), padding=2)
        self.s8 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))
        self.m9 = nn.BatchNorm2d(256)
        self.c9 = nn.Conv2d(256, 256, kernel_size=(3, 3), stride=(1, 1), padding=1)
        self.s10 = nn.MaxPool2d(kernel_size=(2, 2), stride=(2, 2))
        self.d11 = nn.Dropout(p=0.4)
        self.m11 = nn.BatchNorm1d(256 * 4 * 4)
        self.f11 = nn.Linear(256 * 4 * 4, 1024)
        self.d12 = nn.Dropout(p=0.4)
        self.f12 = nn.Linear(1024, N_CLASS)
        
    def forward(self,x, debug=False):
        
        x = self.d1(x)
        x = self.m1(x)
        x = F.relu(self.c1(x))
        x = self.s2(x)
        
        x = self.m3(x)
        x = F.relu(self.c3(x))
        x = self.s4(x)
        
        x = self.m5(x)
        x = F.relu(self.c5(x))
        x = self.s6(x)
        
        x = self.m7(x)
        x = F.relu(self.c7(x))
        x = self.s8(x)
        
        x = self.m9(x)
        x = F.relu(self.c9(x))
        x = self.s10(x)

        # Flatten
        x = x.view(x.size(0),-1)
        
        x = self.d11(x)
        x = self.m11(x)
        x = F.relu(self.f11(x))
  
        x = self.d12(x)
        x = self.f12(x)

        # x = F.softmax(x)
        # x = F.sigmoid(x)

        return x



def genstft(sample_rate, samples):
    
    # to handle stereo sound
    if samples.ndim > 1:
        samples = np.mean(samples, axis=1)
    
    frequencies, times, spectrogram = signal.stft(samples, fs=sample_rate, nperseg=1024, noverlap=0.75*1024)

    cutstft = np.abs(spectrogram)
    nomstft = (cutstft - cutstft.min())/(cutstft.max()-cutstft.min())
    
    return [frequencies, times, nomstft]


def createmask(medstft, sample_size):
    imgstft = medstft.astype(np.uint8)
    
    kernelShape = cv2.MORPH_RECT  # cv2.MORPH_ELLIPSE, cv2.MORPH_CROSS
    kernelSize = 4
    kernel = cv2.getStructuringElement(kernelShape,(kernelSize,kernelSize))
    imgstft = cv2.erode(imgstft, kernel, iterations = 1)
    
    kernelShape = cv2.MORPH_RECT  # cv2.MORPH_ELLIPSE, cv2.MORPH_CROSS
    kernelSize = 4
    kernel = cv2.getStructuringElement(kernelShape,(kernelSize,kernelSize))
    imgstft = cv2.dilate(imgstft, kernel, iterations = 1)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1,4))
    mask = (np.sum(imgstft, axis=0) > 0).astype(np.uint8)
    mask = cv2.dilate(mask, kernel, iterations = 2)
    mask = cv2.resize(mask, (1, sample_size)).reshape(-1)
    
    return [mask, imgstft]


def seperate(wav):
    
    sample_rate, samples = wavfile.read(wav)

    # handle starting noise
    print(samples.shape)
    samples = samples[30000:]

    sample_size = samples.shape[0]

    frequencies, times, nomstft = genstft(sample_rate, samples)

    medstft = np.zeros(nomstft.shape)
    medstft[(nomstft > 3 * np.median(nomstft, axis=0)) & (nomstft.T > 3 * np.median(nomstft, axis=1)).T] = 1
    
    mednoise = np.zeros(nomstft.shape)
    mednoise[(nomstft > 2.5 * np.median(nomstft, axis=0)) & (nomstft.T > 2.5 * np.median(nomstft, axis=1)).T] = 1

    [sigmask, imgstft] = createmask(medstft, sample_size)
    [noisemask, imgnoise] = createmask(mednoise, sample_size)
    noisemask = 1 - noisemask   # np.invert(noisemask.astype(bool)).astype(np.uint8)
    
    sigfile = samples[sigmask > 0]
    sigwav = 'part_signal.wav'
    wavfile.write(sigwav, sample_rate, sigfile)
    
    noisefile = samples[noisemask > 0]
    noisewav = 'part_noise.wav'
    wavfile.write(noisewav, sample_rate, noisefile)


def splitchunks(wav):

    chunks = []
    sample_rate, samples = wavfile.read(wav)
    if samples.shape[0] == 0:
        return chunks

    frequencies, times, nomstft = genstft(sample_rate, samples)

    for i in range(0, nomstft.shape[1], 512):
        chunk = nomstft[:256, i:i+512]
        if chunk.shape[1] < 512:
            chunk = np.concatenate((chunk , nomstft[:256, :512-chunk.shape[1]]), axis=1)

        # downscale
        chunk = cv2.resize(chunk, (256, 128))
        chunks.append(chunk)

    chunks = np.array(chunks)
    return chunks


def idenclass(wav, MODE='binary'):

    seperate(wav)
    test_chunks = splitchunks('part_signal.wav')

    # handle BatchNorm1d error: Expected more than 1 value per channel when training, got input size torch.Size([1, 4096])
    if test_chunks.shape[0] == 1:
        test_chunks = np.vstack((test_chunks, test_chunks))

    testLoader = data.DataLoader(dataset=ABLoader(test_chunks=test_chunks, train=False), batch_size=8, num_workers=4, shuffle=False)

    bestNet = CubeNet()

    if MODE == 'binary':
        checkpoint = torch.load('best80class_bin.pth', map_location=lambda storage, loc: storage)

        def layer(x):
            return F.sigmoid(x)
    else:
        checkpoint = torch.load('bestAB11class.pth')

        def layer(x):
            return F.softmax(x)

    bestNet.load_state_dict(checkpoint['model'])
    bestNet.eval()

    all_pred = []
    testProgressBar = tqdm(enumerate(testLoader),total=len(testLoader),position=0)
    for batchIdx,(image,label) in testProgressBar:
        image = image.float()
        label = label.numpy()

        predicted = layer(bestNet(image)).detach().numpy()
        all_pred += list(predicted)

    all_pred = np.array(all_pred)

    # print()
    # print('all predicted class no:', all_pred)

    # amean = np.mean(apred, axis=0)
    amax = np.max(all_pred, axis=0)
    prob = np.array(sorted(amax)) * 100
    classNo = np.array(np.argsort(amax))

    avgclass = []
    for i in range(10):
        if prob[-i] > 5:
            avgclass.append((round(float(prob[-i]), 2), int(classNo[-i])))
    
    print(type(prob[-1]))
    
    print(sorted(avgclass, reverse=True))

    return sorted(avgclass, reverse=True)