CREATE TABLE `animali` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matricola` varchar(50) NOT NULL,
	`nome` varchar(100),
	`gruppo` varchar(100),
	`razza` varchar(100),
	`dataNascita` date,
	`sesso` enum('femmina','maschio') NOT NULL DEFAULT 'femmina',
	`stato` enum('attiva','asciutta','gravida','infermeria','venduta','morta') NOT NULL DEFAULT 'attiva',
	`produzioneMedia` decimal(8,2),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `animali_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fondiReintegrazione` (
	`id` int AUTO_INCREMENT NOT NULL,
	`macchinaId` int NOT NULL,
	`nomeDisplay` varchar(255) NOT NULL,
	`valoreAcquisto` decimal(14,2) NOT NULL,
	`fondoAttuale` decimal(14,2) NOT NULL DEFAULT '0',
	`tassoInteresse` decimal(5,3) DEFAULT '0.030',
	`annoObiettivo` int,
	`rataConsigliata` decimal(12,2),
	`attivo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fondiReintegrazione_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gravidanze` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animaleId` int NOT NULL,
	`dataInseminazione` date NOT NULL,
	`dataPartoPrevisto` date,
	`dataPartoEffettivo` date,
	`stato` enum('in_corso','partorita','abortita') NOT NULL DEFAULT 'in_corso',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gravidanze_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rateReintegrazione` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fondoId` int NOT NULL,
	`importo` decimal(12,2) NOT NULL,
	`data` date NOT NULL,
	`tipo` enum('programmata','extra') NOT NULL DEFAULT 'programmata',
	`pagata` boolean NOT NULL DEFAULT false,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rateReintegrazione_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trattamentiAnimali` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animaleId` int NOT NULL,
	`tipo` enum('sincronizzazione','vaccino','farmaco','visita','altro') NOT NULL DEFAULT 'altro',
	`farmaco` varchar(255),
	`dose` varchar(100),
	`dataTrattamento` timestamp NOT NULL,
	`prossimoTrattamento` timestamp,
	`veterinario` varchar(255),
	`stato` enum('pianificato','eseguito','saltato') NOT NULL DEFAULT 'pianificato',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trattamentiAnimali_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zoppie` (
	`id` int AUTO_INCREMENT NOT NULL,
	`animaleId` int NOT NULL,
	`dataRilevazione` date NOT NULL,
	`score` int DEFAULT 1,
	`zampa` varchar(50),
	`diagnosi` text,
	`trattamento` text,
	`stato` enum('aperta','in_trattamento','risolta') NOT NULL DEFAULT 'aperta',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `zoppie_id` PRIMARY KEY(`id`)
);
