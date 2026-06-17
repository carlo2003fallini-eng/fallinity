CREATE TABLE `azienda` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`partitaIva` varchar(20),
	`codiceFiscale` varchar(20),
	`indirizzo` text,
	`citta` varchar(100),
	`provincia` varchar(50),
	`cap` varchar(10),
	`telefono` varchar(20),
	`email` varchar(320),
	`settore` varchar(100),
	`ettari` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `azienda_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoria` varchar(100) NOT NULL,
	`anno` int NOT NULL,
	`mese` int,
	`importoPrevisto` decimal(12,2) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `budget_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campi` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`codice` varchar(50),
	`ettari` decimal(10,2) NOT NULL,
	`comune` varchar(100),
	`provincia` varchar(50),
	`coltura` varchar(100),
	`stato` enum('attivo','a_riposo','in_lavorazione') NOT NULL DEFAULT 'attivo',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campi_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`ruolo` enum('user','assistant') NOT NULL,
	`contenuto` text NOT NULL,
	`reasoning` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`titolo` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contatti` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('dipendente','fornitore','cliente') NOT NULL,
	`nome` varchar(255) NOT NULL,
	`cognome` varchar(255),
	`aziendaNome` varchar(255),
	`email` varchar(320),
	`telefono` varchar(20),
	`indirizzo` text,
	`citta` varchar(100),
	`ruolo` varchar(100),
	`note` text,
	`attivo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contatti_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventi` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titolo` varchar(255) NOT NULL,
	`descrizione` text,
	`tipo` enum('lavorazione','manutenzione','scadenza','altro') NOT NULL DEFAULT 'altro',
	`dataInizio` timestamp NOT NULL,
	`dataFine` timestamp,
	`tuttoIlGiorno` boolean DEFAULT false,
	`completato` boolean DEFAULT false,
	`colore` varchar(20),
	`riferimentoId` int,
	`riferimentoTipo` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventi_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interventi` (
	`id` int AUTO_INCREMENT NOT NULL,
	`macchinaId` int NOT NULL,
	`tipo` enum('manutenzione','riparazione','revisione') NOT NULL,
	`descrizione` text NOT NULL,
	`data` date NOT NULL,
	`dataCompletamento` date,
	`priorita` enum('alta','media','bassa') NOT NULL DEFAULT 'media',
	`stato` enum('pianificato','in_corso','completato') NOT NULL DEFAULT 'pianificato',
	`costoManodopera` decimal(10,2),
	`costoRicambi` decimal(10,2),
	`operatore` varchar(255),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interventi_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lavorazioni` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campoId` int NOT NULL,
	`tipo` varchar(100) NOT NULL,
	`descrizione` text,
	`data` date NOT NULL,
	`operatore` varchar(255),
	`costo` decimal(12,2),
	`stato` enum('pianificata','in_corso','completata') NOT NULL DEFAULT 'pianificata',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lavorazioni_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `macchine` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`marca` varchar(100),
	`modello` varchar(100),
	`targa` varchar(20),
	`telaio` varchar(100),
	`anno` int,
	`oreTotali` decimal(10,1) DEFAULT '0',
	`stato` enum('operativo','manutenzione','fermo') NOT NULL DEFAULT 'operativo',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `macchine_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentiMagazzino` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prodottoId` int NOT NULL,
	`tipo` enum('carico','scarico') NOT NULL,
	`quantita` decimal(12,3) NOT NULL,
	`data` date NOT NULL,
	`descrizione` text,
	`operatore` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentiMagazzino_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prodotti` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`codice` varchar(100),
	`categoria` varchar(100),
	`unitaMisura` varchar(50),
	`quantita` decimal(12,3) NOT NULL DEFAULT '0',
	`quantitaMinima` decimal(12,3) DEFAULT '0',
	`prezzoUnitario` decimal(12,2),
	`fornitoreId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prodotti_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transazioni` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('entrata','uscita') NOT NULL,
	`categoria` varchar(100) NOT NULL,
	`descrizione` text,
	`importo` decimal(12,2) NOT NULL,
	`data` date NOT NULL,
	`contattoId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transazioni_id` PRIMARY KEY(`id`)
);
